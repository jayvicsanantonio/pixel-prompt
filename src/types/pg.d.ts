declare module "pg" {
  export interface PoolConfig {
    connectionString?: string;
    max?: number;
  }

  export interface QueryResultRow {
    [column: string]: unknown;
  }

  export interface QueryResult<R extends QueryResultRow = QueryResultRow> {
    command: string;
    rowCount: number | null;
    oid: number;
    rows: R[];
    fields: Array<{ name: string }>;
  }

  export class Client {
    constructor(config?: PoolConfig);
    query(...args: unknown[]): Promise<QueryResult>;
    connect(): Promise<void>;
    end(): Promise<void>;
  }

  export class PoolClient extends Client {
    release(err?: boolean | Error): void;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query(...args: unknown[]): Promise<QueryResult>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }

  const pg: {
    Pool: typeof Pool;
    Client: typeof Client;
  };

  namespace pg {
    export type Pool = import("pg").Pool;
    export type Client = import("pg").Client;
  }

  export default pg;
}
