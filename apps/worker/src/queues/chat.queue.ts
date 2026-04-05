import { Queue } from 'bullmq';
import { redisConnection } from './connection.js';

export const CHAT_QUEUE_NAME = 'chat';

export const chatQueue = new Queue(CHAT_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export interface GenerateTitlePayload {
  conversationId: string;
}
