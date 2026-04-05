'use client';

import { MessageSquare } from 'lucide-react';
import { useChat, type ChatMessage } from '@/hooks/use-chat';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import { Shimmer } from '@/components/ai-elements/shimmer';

function ChatMessageItem({ message }: { message: ChatMessage }) {
  return (
    <Message from={message.role}>
      <MessageContent>
        {message.role === 'user' ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : message.content ? (
          <MessageResponse isAnimating={message.isStreaming}>
            {message.content}
          </MessageResponse>
        ) : message.isStreaming ? (
          <Shimmer duration={1}>Thinking...</Shimmer>
        ) : null}
      </MessageContent>
    </Message>
  );
}

export default function ChatPage() {
  const { messages, isStreaming, error, sendMessage, stopStreaming } = useChat();

  const status = isStreaming ? 'streaming' : 'ready';

  const handleSubmit = async (msg: PromptInputMessage) => {
    const trimmed = msg.text.trim();
    if (!trimmed || isStreaming) return;
    await sendMessage(trimmed);
  };

  return (
    <div className="flex h-full flex-col">
      {messages.length === 0 ? (
        <ConversationEmptyState
          icon={<MessageSquare className="h-8 w-8" />}
          title="Start a conversation"
          description="Type a message below to begin chatting."
          className="flex-1"
        />
      ) : (
        <Conversation className="flex-1">
          <ConversationContent className="mx-auto max-w-3xl">
            {messages.map((msg) => (
              <ChatMessageItem key={msg.id} message={msg} />
            ))}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      {error && (
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2 text-sm text-destructive">
          <span>{error}</span>
        </div>
      )}

      <div className="border-t bg-background px-4 py-3">
        <div className="mx-auto max-w-3xl">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea placeholder="Type a message..." />
            <PromptInputFooter>
              <div />
              <PromptInputSubmit status={status} onStop={stopStreaming} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
