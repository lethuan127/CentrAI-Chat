import { z } from 'zod';

// ─── SSE Event Names ─────────────────────────────────────────

export const ChatStreamEventType = {
  TOKEN: 'token',
  DONE: 'done',
  ERROR: 'error',
  STOPPED: 'stopped',
  CONVERSATION_CREATED: 'conversation_created',
} as const;

export type ChatStreamEventType =
  (typeof ChatStreamEventType)[keyof typeof ChatStreamEventType];

// ─── SSE Event Payloads ──────────────────────────────────────

export const chatTokenEventSchema = z.object({
  event: z.literal('token'),
  data: z.object({
    content: z.string(),
  }),
});

export type ChatTokenEvent = z.infer<typeof chatTokenEventSchema>;

export const chatDoneEventSchema = z.object({
  event: z.literal('done'),
  data: z.object({
    messageId: z.string().uuid(),
    usage: z
      .object({
        promptTokens: z.number().int().nonnegative(),
        completionTokens: z.number().int().nonnegative(),
      })
      .optional(),
  }),
});

export type ChatDoneEvent = z.infer<typeof chatDoneEventSchema>;

export const chatErrorEventSchema = z.object({
  event: z.literal('error'),
  data: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ChatErrorEvent = z.infer<typeof chatErrorEventSchema>;

export const chatStoppedEventSchema = z.object({
  event: z.literal('stopped'),
  data: z.object({
    messageId: z.string().uuid(),
    content: z.string(),
  }),
});

export type ChatStoppedEvent = z.infer<typeof chatStoppedEventSchema>;

// ─── Union Type ──────────────────────────────────────────────

export const chatConversationCreatedEventSchema = z.object({
  event: z.literal('conversation_created'),
  data: z.object({
    conversationId: z.string().uuid(),
    title: z.string().nullable(),
  }),
});

export type ChatConversationCreatedEvent = z.infer<typeof chatConversationCreatedEventSchema>;

export type ChatStreamEvent =
  | ChatTokenEvent
  | ChatDoneEvent
  | ChatErrorEvent
  | ChatStoppedEvent
  | ChatConversationCreatedEvent;
