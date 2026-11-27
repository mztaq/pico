declare module 'sql.js' {
  export type SqlValue = number | string | Uint8Array | null;
  export interface Statement {
    run(values?: SqlValue[]): void;
    step(): boolean;
    get(): SqlValue[];
    getColumnNames(): string[];
    free(): boolean;
  }
  export interface Database {
    run(sql: string, values?: SqlValue[]): Database;
    exec(sql: string): { columns: string[]; values: SqlValue[][] }[];
    prepare(sql: string): Statement;
    iterateStatements(sql: string): Iterable<Statement>;
    export(): Uint8Array;
    close(): void;
  }
  export interface SqlModule { Database: new (data?: Uint8Array) => Database; }
  export default function initSqlJs(options?: { locateFile?: (filename: string) => string }): Promise<SqlModule>;
}
