import type { ExecutionReply } from '../worker';
import type { PythonRequest } from './config';

interface PythonScope { set: (name: string, value: unknown) => void; destroy: () => void; }
export interface PythonRuntime {
  runPython: (code: string, options?: { globals: PythonScope }) => unknown;
  registerJsModule: (name: string, module: unknown) => void;
  unregisterJsModule: (name: string) => void;
}
export interface PythonIO {
  flush?: () => void;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  readInput: (prompt: string, line: number) => string;
}

/** The same CPython execution wrapper runs in the browser worker and integration tests. */
export function runPythonProgram(runtime: PythonRuntime, request: PythonRequest, io: PythonIO): ExecutionReply {
  runtime.runPython("import sys; sys.modules.pop('_pico_bridge', None);");
  runtime.registerJsModule('_pico_bridge', {
    stdout: io.stdout, stderr: io.stderr, read_input: io.readInput, flush: io.flush ?? (() => {}),
  });
  const scope = runtime.runPython('dict()') as PythonScope;
  try {
    scope.set('_pico_request_json', JSON.stringify(request, (key, value) => key.endsWith('Buffer') || key === 'outputAck' ? undefined : value));
    return JSON.parse(String(runtime.runPython(PYTHON_DRIVER, { globals: scope }))) as ExecutionReply;
  } finally {
    scope.destroy();
    runtime.unregisterJsModule('_pico_bridge');
    runtime.runPython("import sys; sys.modules.pop('_pico_bridge', None);");
  }
}

export const PYTHON_DRIVER = String.raw`
import builtins as _builtins
import sys as _sys
import io as _io
import json as _json
import os as _os
import traceback as _traceback
import types as _types
import importlib as _importlib
from collections import deque as _deque
import _pico_bridge as _bridge

_request = _json.loads(_pico_request_json)
_filename = _request['filename']
_source_names = set(_request['sources']) | {_filename}
_output = _deque(maxlen=2000)
_output_truncated = False
_trace = []
_trace_budget = 200000
_trace_truncated = False
_steps = 0
_current_line = 1
_main_module = _types.ModuleType('__main__')
_namespace = _main_module.__dict__
_namespace.update({'__file__': _filename, '__builtins__': _builtins})

# Never invoke a user's __repr__ while inspecting their variables.
def _safe(value, depth=0):
    t = type(value)
    if value is None or t is bool:
        return value
    if t is int:
        return value if abs(value) <= 9007199254740991 else str(value)
    if t is float:
        return value if _json.dumps(value, allow_nan=True) not in ('NaN', 'Infinity', '-Infinity') else str(value)
    if t is str:
        return value[:1000]
    if depth >= 3:
        return '<' + t.__name__ + '>'
    if t in (list, tuple):
        return [_safe(x, depth + 1) for x in value[:20]]
    if t is dict:
        return {str(_safe(k, depth + 1)): _safe(v, depth + 1) for k, v in list(value.items())[:20]}
    if t is set:
        return [_safe(x, depth + 1) for x in list(value)[:20]]
    return '<' + t.__name__ + '>'

def _variables(values):
    return {k: _safe(v) for k, v in list(values.items())[:200] if not k.startswith('_') and type(v) not in (_types.ModuleType, _types.FunctionType, type)}

def _record(line, values, label):
    global _trace_budget, _trace_truncated
    if _trace_truncated:
        return
    step = {'line': line, 'variables': _variables(values), 'output': list(_output), 'label': label}
    cost = len(_json.dumps(step))
    if cost > _trace_budget:
        _trace_truncated = True
        return
    _trace_budget -= cost
    _trace.append(step)

def _tracer(frame, event, arg):
    global _steps, _current_line
    if frame.f_code.co_filename in _source_names and event == 'line':
        _steps += 1
        _current_line = frame.f_lineno
        values = dict(frame.f_globals)
        values.update(frame.f_locals)
        label = ('Call: ' + frame.f_code.co_name) if frame.f_code.co_name != '<module>' else 'Line'
        _record(frame.f_lineno, values, label)
    return _tracer

class _Console(_io.TextIOBase):
    def __init__(self, error=False):
        self.pending = ''
        self.error = error
    def writable(self):
        return True
    def isatty(self):
        return True
    def _emit(self, line):
        global _output_truncated
        if len(line) > 8192:
            line = line[:8192]
            _output_truncated = True
        if self.error:
            _bridge.stderr(line)
        else:
            if len(_output) == 2000:
                _output_truncated = True
            _output.append(line)
            _bridge.stdout(line)
    def write(self, value):
        global _output_truncated
        if not isinstance(value, str):
            raise TypeError('write() argument must be str')
        # Consume incrementally so long-running output never builds an unbounded buffer.
        parts = value.split('\n')
        for index, part in enumerate(parts):
            if index:
                self._emit(self.pending)
                self.pending = ''
            available = 8192 - len(self.pending)
            self.pending += part[:available]
            if len(part) > available:
                _output_truncated = True
        return len(value)
    def flush(self):
        if self.pending:
            self._emit(self.pending)
            self.pending = ''
        _bridge.flush()

_stdout = _Console()
_stderr = _Console(True)
_original_stdout, _original_stderr, _original_input = _sys.stdout, _sys.stderr, _builtins.input
_original_trace = _sys.gettrace()
_original_cwd = _os.getcwd()
_original_path = list(_sys.path)
_original_argv = list(_sys.argv)
_original_environment = dict(_os.environ)
_original_modules = dict(_sys.modules)
_original_module_dicts = [(module, dict(module.__dict__)) for module in _sys.modules.values() if isinstance(module, _types.ModuleType) and module.__name__ != '__main__']
_original_settrace = _sys.settrace

def _input(prompt=''):
    if prompt:
        print(prompt, end='', flush=True)
    _stdout.flush()
    line = _sys._getframe(1).f_lineno
    return _bridge.read_input(str(prompt), line)

_error = None
_files = {}
try:
    _os.makedirs('/workspace', exist_ok=True)
    _os.chdir('/workspace')
    # Reset project files and imports while retaining the loaded interpreter.
    for root, dirs, files in _os.walk('.', topdown=False):
        for file in files:
            _os.remove(_os.path.join(root, file))
        for directory in dirs:
            _os.rmdir(_os.path.join(root, directory))
    for name, module in list(_sys.modules.items()):
        if str(getattr(module, '__file__', '')).startswith('/workspace/'):
            del _sys.modules[name]
    _sys.path.insert(0, '/workspace')
    for name, lines in _request['files'].items():
        if name.startswith('/') or '..' in name.split('/'):
            continue
        parent = _os.path.dirname(name)
        if parent:
            _os.makedirs(parent, exist_ok=True)
        with open(name, 'w', encoding='utf-8') as file:
            file.write('\n'.join(lines))
    for name, source in _request['sources'].items():
        if '/' not in name and '\\' not in name:
            with open(name, 'w', encoding='utf-8') as file:
                file.write(source)
    with open(_filename, 'w', encoding='utf-8') as file:
        file.write(_request['code'])
    _importlib.invalidate_caches()
    _sys.modules['__main__'] = _main_module
    _sys.stdout, _sys.stderr, _builtins.input = _stdout, _stderr, _input
    _compiled = compile(_request['code'], _filename, 'exec')
    if _request['debug']:
        _sys.settrace(_tracer)
    exec(_compiled, _namespace, _namespace)
except BaseException as exception:
    if not (isinstance(exception, SystemExit) and exception.code in (None, 0)):
        user_frames = [frame for frame in _traceback.extract_tb(exception.__traceback__) if frame.filename in _source_names]
        line = exception.lineno if isinstance(exception, SyntaxError) else (user_frames[-1].lineno if user_frames else _current_line)
        _current_line = line
        _error = {'message': type(exception).__name__ + ': ' + str(exception), 'line': line, 'code': 'python', 'diagnostic': ''.join(_traceback.format_exception_only(exception)) if isinstance(exception, SyntaxError) else ''.join(_traceback.format_list(user_frames)) + type(exception).__name__ + ': ' + str(exception)}
finally:
    _original_settrace(_original_trace)
    _stdout.flush()
    _stderr.flush()
    # Restore module attributes and builtins changed by user code before the next run.
    for module, attributes in _original_module_dicts:
        module.__dict__.clear()
        module.__dict__.update(attributes)
    _sys.modules.clear()
    _sys.modules.update(_original_modules)
    _sys.argv[:] = _original_argv
    _os.environ.clear()
    _os.environ.update(_original_environment)
    _sys.stdout, _sys.stderr, _builtins.input = _original_stdout, _original_stderr, _original_input
    if _request['debug']:
        _record(_current_line, _namespace, 'Error' if _error else 'Finished')
    for root, dirs, files in _os.walk('/workspace'):
        dirs[:] = [name for name in dirs if name != '__pycache__']
        for name in files:
            path = _os.path.join(root, name)
            relative = _os.path.relpath(path, '/workspace')
            if relative in _source_names:
                continue
            try:
                with open(path, encoding='utf-8') as file:
                    _files[relative] = file.read(1000000).splitlines()
            except (UnicodeError, OSError):
                pass
    _os.chdir(_original_cwd)
    _sys.path[:] = _original_path

_json.dumps({'result': {'output': list(_output), 'variables': _variables(_namespace), 'coverage': [], 'trace': _trace, 'steps': _steps, 'files': _files, 'traceTruncated': _trace_truncated, 'outputTruncated': _output_truncated}, **({'error': _error} if _error else {})}, allow_nan=False)
`;
