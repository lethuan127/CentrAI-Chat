import type { ConnectionOptions } from 'node:tls';
import { PostgresStore } from '@mastra/pg';

export const CENTRAI_MASTRA_PG_STORE_ID = 'centrai-agent-runtime';

export interface CreateCentrAiPostgresStoreOptions {
  connectionString: string;
  /** Defaults to `mastra` so Mastra tables stay out of Prisma’s `public` schema. */
  schemaName?: string;
  ssl?: boolean | ConnectionOptions;
  max?: number;
  idleTimeoutMillis?: number;
  /** When true, `init()` does not create/alter tables (use in CI if you migrate separately). */
  disableInit?: boolean;
}

/**
 * PostgreSQL storage for Mastra (workflows, traces, debug-oriented message/thread stores).
 * End-user chat display should use application conversation messages, not Mastra tables as the trusted source.
 * @see https://mastra.ai/reference/storage/postgresql
 */
export function createCentrAiPostgresStore(options: CreateCentrAiPostgresStoreOptions): PostgresStore {
  return new PostgresStore({
    id: CENTRAI_MASTRA_PG_STORE_ID,
    connectionString: options.connectionString,
    schemaName: options.schemaName ?? 'mastra',
    ...(options.ssl !== undefined ? { ssl: options.ssl } : {}),
    ...(options.max !== undefined ? { max: options.max } : {}),
    ...(options.idleTimeoutMillis !== undefined
      ? { idleTimeoutMillis: options.idleTimeoutMillis }
      : {}),
    ...(options.disableInit !== undefined ? { disableInit: options.disableInit } : {}),
  });
}

export type { PostgresStore } from '@mastra/pg';
