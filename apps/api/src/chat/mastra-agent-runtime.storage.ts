import { createCentrAiPostgresStore, type PostgresStore } from '@centrai/agent';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Mastra {@link PostgresStore} for **non-chat** agent runtime: workflows, traces, debug tooling.
 * End-user chat history stays in Prisma (`conversations` / `messages`); do not mirror that here for UI.
 *
 * Gated by `MASTRA_PG_ENABLED` so chat servers do not create Mastra tables unless needed.
 *
 * @see https://mastra.ai/reference/storage/postgresql
 */
@Injectable()
export class MastraAgentRuntimeStorage implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MastraAgentRuntimeStorage.name);
  private store: PostgresStore | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const enabled =
      this.config.get<string>('MASTRA_PG_ENABLED', 'false').toLowerCase() === 'true';
    if (!enabled) {
      this.logger.log('Mastra PostgreSQL storage disabled (MASTRA_PG_ENABLED!=true); chat uses Prisma only.');
      return;
    }

    const connectionString = this.config.getOrThrow<string>('DATABASE_URL');
    const schemaName = this.config.get<string>('MASTRA_PG_SCHEMA', 'mastra');
    const disableInit =
      this.config.get<string>('MASTRA_PG_DISABLE_INIT', 'false').toLowerCase() === 'true';

    this.store = createCentrAiPostgresStore({
      connectionString,
      schemaName,
      disableInit,
    });

    if (disableInit) {
      this.logger.warn(
        'MASTRA_PG_DISABLE_INIT=true: skipping PostgresStore.init(); ensure Mastra tables exist.',
      );
      return;
    }

    await this.store.init();
    this.logger.log(`Mastra PostgreSQL storage ready (schema: ${schemaName})`);
  }

  /** Store for workflow/debug features; `null` when disabled or not yet initialized. */
  getStore(): PostgresStore | null {
    return this.store;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.store) {
      await this.store.close();
      this.store = null;
    }
  }
}
