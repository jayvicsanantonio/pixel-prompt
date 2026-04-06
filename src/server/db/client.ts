import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { schema } from "./schema";

const DATABASE_URL_ERROR = "DATABASE_URL must be set before using the PostgreSQL persistence layer.";

type Database = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __pixelPromptDbPool__: Pool | undefined;
  var __pixelPromptDb__: Database | undefined;
}

function getDatabaseUrl() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(DATABASE_URL_ERROR);
  }

  return connectionString;
}

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function createDatabase(connectionString = getDatabaseUrl()) {
  const pool = new Pool({
    connectionString,
    max: 10,
  });

  return drizzle({
    client: pool,
    schema,
  });
}

export function getDatabase() {
  if (!globalThis.__pixelPromptDbPool__) {
    globalThis.__pixelPromptDbPool__ = new Pool({
      connectionString: getDatabaseUrl(),
      max: 10,
    });
  }

  if (!globalThis.__pixelPromptDb__) {
    globalThis.__pixelPromptDb__ = drizzle({
      client: globalThis.__pixelPromptDbPool__,
      schema,
    });
  }

  return globalThis.__pixelPromptDb__;
}

export type { Database };
