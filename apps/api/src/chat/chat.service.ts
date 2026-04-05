import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import type { ChatStreamEvent } from '@centrai/types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly activeStreams = new Map<string, AbortController>();

  async streamMessage(
    userId: string,
    dto: { conversationId?: string; content: string; agentId?: string; modelId?: string },
    res: Response,
  ): Promise<void> {
    const messageId = crypto.randomUUID();
    const abortController = new AbortController();
    this.activeStreams.set(messageId, abortController);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('X-Message-Id', messageId);
    res.flushHeaders();

    const signal = abortController.signal;

    try {
      // TODO: Replace with real provider adapter call when Phase 5 is implemented.
      // The placeholder below echoes back the user's content as streamed tokens.
      const tokens = dto.content.split(' ');
      let accumulated = '';

      for (const token of tokens) {
        if (signal.aborted) {
          this.writeSSE(res, {
            event: 'stopped',
            data: { messageId, content: accumulated.trim() },
          });
          return;
        }

        const chunk = (accumulated ? ' ' : '') + token;
        accumulated += chunk;

        this.writeSSE(res, {
          event: 'token',
          data: { content: chunk },
        });

        await this.delay(50, signal);
      }

      // TODO: Persist assistant message to DB when Conversation/Message models exist (Phase 3.1)
      this.writeSSE(res, {
        event: 'done',
        data: {
          messageId,
          usage: { promptTokens: tokens.length, completionTokens: tokens.length },
        },
      });
    } catch (error: unknown) {
      if (signal.aborted) return;

      const message = error instanceof Error ? error.message : 'Stream failed';
      this.logger.error(`Stream error for message ${messageId}`, message);
      this.writeSSE(res, {
        event: 'error',
        data: { code: 'STREAM_ERROR', message },
      });
    } finally {
      this.activeStreams.delete(messageId);
      res.end();
    }
  }

  stopStream(messageId: string): void {
    const controller = this.activeStreams.get(messageId);
    if (!controller) {
      throw new NotFoundException(`No active stream for message ${messageId}`);
    }
    controller.abort();
  }

  private writeSSE(res: Response, event: ChatStreamEvent): void {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  private delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }
}
