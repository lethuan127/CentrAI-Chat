import { z } from 'zod';
import type { Role } from './models';

// ─── Auth DTOs ──────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(1, 'Name is required').max(100),
});

export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

// ─── Response Envelope ──────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  error: null;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  data: null;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}

// ─── Chat DTOs ───────────────────────────────────────────────

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  content: z.string().min(1, 'Message cannot be empty').max(100_000),
  agentId: z.string().uuid().optional(),
  modelId: z.string().optional(),
  providerId: z.string().optional(),
});

export type SendMessageDto = z.infer<typeof sendMessageSchema>;

// ─── Conversation DTOs ───────────────────────────────────────

export const createConversationSchema = z.object({
  agentId: z.string().uuid().optional(),
  modelId: z.string().optional(),
  providerId: z.string().optional(),
  title: z.string().max(200).optional(),
});

export type CreateConversationDto = z.infer<typeof createConversationSchema>;

export const conversationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

export type ConversationQueryDto = z.infer<typeof conversationQuerySchema>;

export const messageQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  before: z.string().datetime().optional(),
});

export type MessageQueryDto = z.infer<typeof messageQuerySchema>;

// ─── Agent DTOs ──────────────────────────────────────────────

export const createAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  role: z.string().min(1, 'Role is required').max(10_000),
  instructions: z.string().min(1, 'Instructions are required').max(50_000),
  expectedOutput: z.string().max(10_000).optional(),
  modelId: z.string().optional(),
  modelProvider: z.string().optional(),
  modelTemperature: z.number().min(0).max(2).default(0.7),
  modelMaxTokens: z.number().int().positive().optional(),
  addSessionStateToContext: z.boolean().default(false),
  maxTurnsMessageHistory: z.number().int().positive().optional(),
  enableSessionSummaries: z.boolean().default(false),
  tools: z.array(z.record(z.unknown())).default([]),
  tags: z.array(z.string().max(50)).max(20).default([]),
});

export type CreateAgentDto = z.infer<typeof createAgentSchema>;

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  role: z.string().min(1).max(10_000).optional(),
  instructions: z.string().min(1).max(50_000).optional(),
  expectedOutput: z.string().max(10_000).optional().nullable(),
  modelId: z.string().optional().nullable(),
  modelProvider: z.string().optional().nullable(),
  modelTemperature: z.number().min(0).max(2).optional(),
  modelMaxTokens: z.number().int().positive().optional().nullable(),
  addSessionStateToContext: z.boolean().optional(),
  maxTurnsMessageHistory: z.number().int().positive().optional().nullable(),
  enableSessionSummaries: z.boolean().optional(),
  tools: z.array(z.record(z.unknown())).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  changelog: z.string().max(500).optional(),
});

export type UpdateAgentDto = z.infer<typeof updateAgentSchema>;

export const agentQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  tags: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['name', 'createdAt', 'updatedAt', 'version']).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type AgentQueryDto = z.infer<typeof agentQuerySchema>;

// ─── Auth Responses ─────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    role: Role;
  };
  tokens: TokenPair;
}
