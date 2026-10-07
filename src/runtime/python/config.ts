// Pin the browser distribution. Report sys.version at runtime, not this tag as Python's version.
export const PYODIDE_VERSION = '314.0.7';
export const PYODIDE_INDEX_URL = `/python-runtime/${PYODIDE_VERSION}/`;
export const PYTHON_STARTER = '# PICO - Python Compiler made by Mustaqim and Amar\n\nname = input("Enter your name: ")\nprint(f"Hello {name}!")';
export const MAX_CONSOLE_LINES = 2000;
export const MAX_INPUT_BYTES = 1_048_576;
export interface PythonRequest {
  code: string;
  filename: string;
  debug: boolean;
  files: Record<string, string[]>;
  sources: Record<string, string>;
  inputBuffer?: SharedArrayBuffer;
  outputAck?: SharedArrayBuffer;
}

export type PythonWorkerRequest = PythonRequest | { type: 'prepare' };
