import path from 'node:path';
import { config as loadEnv } from 'dotenv';

// Repo-root `.env` (same layout as API); package-local `.env` overrides when present.
loadEnv({ path: path.resolve(process.cwd(), '../../.env') });
loadEnv({ path: path.resolve(process.cwd(), '.env'), override: true });
import { Worker } from 'bullmq';
import { PrismaClient } from '../../api/src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { redisConnection } from './queues/connection.js';
import { CHAT_QUEUE_NAME } from './queues/chat.queue.js';
import { processGenerateTitle } from './jobs/generate-title.job.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.$connect();
  console.log('[worker] Connected to database');

  const chatWorker = new Worker(
    CHAT_QUEUE_NAME,
    async (job) => {
      switch (job.name) {
        case 'generate-title':
          await processGenerateTitle(job, prisma);
          break;
        default:
          console.warn(`[worker] Unknown job: ${job.name}`);
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
    },
  );

  chatWorker.on('completed', (job) => {
    console.log(`[worker] Job ${job.name}:${job.id} completed`);
  });

  chatWorker.on('failed', (job, err) => {
    console.error(`[worker] Job ${job?.name}:${job?.id} failed: ${err.message}`);
  });

  console.log('[worker] Chat worker started, waiting for jobs...');

  const shutdown = async () => {
    console.log('[worker] Shutting down...');
    await chatWorker.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
