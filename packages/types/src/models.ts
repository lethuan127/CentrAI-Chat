import { z } from 'zod';

export const Role = {
  ADMIN: 'ADMIN',
  DEVELOPER: 'DEVELOPER',
  USER: 'USER',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const AuthProvider = {
  LOCAL: 'LOCAL',
  GOOGLE: 'GOOGLE',
  GITHUB: 'GITHUB',
} as const;

export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatar: z.string().url().nullable(),
  role: z.enum(['ADMIN', 'DEVELOPER', 'USER']),
  authProvider: z.enum(['LOCAL', 'GOOGLE', 'GITHUB']),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type User = z.infer<typeof userSchema>;
