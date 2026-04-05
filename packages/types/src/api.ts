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
});

export type SendMessageDto = z.infer<typeof sendMessageSchema>;

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
