'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    // Password reset is a placeholder for now — will be fully wired in a future iteration
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSent(true);
    setIsLoading(false);
  }

  if (isSent) {
    return (
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Check your email</h2>
        <p className="text-muted-foreground">
          If an account exists for <strong>{email}</strong>, we&apos;ve sent password reset
          instructions.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight">Reset password</h2>
        <p className="mt-2 text-muted-foreground">
          Enter your email and we&apos;ll send you reset instructions.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Send reset link
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary/80"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to login
        </Link>
      </p>
    </div>
  );
}
