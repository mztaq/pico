import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { executeSql, type SqlRequest, type WorkerReply } from './engine';

const scope = self as unknown as { onmessage: ((event: MessageEvent<SqlRequest>) => void) | null; postMessage: (message: WorkerReply) => void };
let runtime: ReturnType<typeof initSqlJs> | undefined;
scope.onmessage = async event => {
  try {
    runtime ??= initSqlJs({ locateFile: () => wasmUrl });
    const SQL = await runtime;
    scope.postMessage({ ready: true });
    scope.postMessage({ ok: true, value: executeSql(SQL, event.data) });
  } catch (error) {
    scope.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
