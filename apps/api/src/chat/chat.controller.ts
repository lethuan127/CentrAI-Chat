import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Request, Response } from 'express';
import {
  createConversationSchema,
  conversationQuerySchema,
  messageQuerySchema,
  exportConversationSchema,
  updateActiveLeafSchema,
  editUserMessageSchema,
} from '@centrai/types';
import type {
  CreateConversationDto,
  ConversationQueryDto,
  MessageQueryDto,
  ExportConversationDto,
  UpdateActiveLeafDto,
  EditUserMessageDto,
} from '@centrai/types';
import { createCentrAiChatStream, createMastraAgent } from '@centrai/agent';
import {
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
  convertToModelMessages,
} from 'ai';
import type { InferUIMessageChunk, UIMessage } from 'ai';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ChatService } from './chat.service';
import { LlmService } from '../llm';
import { extractMessageParts } from './message-parts';
import type { ExtractedParts } from './message-parts';
import {
  CreateConversationBody,
  ConversationModel,
  MessageModel,
} from '../common/swagger/schemas';
import { apiEnvelopeSchema } from '../common/swagger/zod-to-openapi';

@ApiTags('Chat')
@ApiBearerAuth('bearer')
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly llmService: LlmService,
  ) {}

  @Get('enabled-models')
  @ApiOperation({ summary: 'List LLM models available from environment-configured backends' })
  @ApiResponse({ status: 200, description: 'Models grouped by backend (requires matching API keys in env)' })
  async getEnabledModels(@CurrentUser() _user: { id: string }) {
    const models = this.llmService.getEnabledModelGroups();
    return { data: models, error: null };
  }

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new conversation' })
  @ApiBody({ schema: CreateConversationBody, description: 'Conversation options (agent, model, title)' })
  @ApiResponse({ status: 201, description: 'Conversation created', schema: apiEnvelopeSchema(ConversationModel) })
  async createConversation(
    @Body(new ZodValidationPipe(createConversationSchema)) dto: CreateConversationDto,
    @CurrentUser() user: { id: string; workspaceId: string },
  ) {
    const conversation = await this.chatService.createConversation(user.id, user.workspaceId, dto);
    return { data: conversation, error: null };
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List user conversations with search, filtering, and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search in title and messages' })
  @ApiQuery({ name: 'agentId', required: false, type: String, description: 'Filter by agent ID' })
  @ApiQuery({ name: 'modelId', required: false, type: String, description: 'Filter by model ID' })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'Start date filter (ISO 8601)' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'End date filter (ISO 8601)' })
  @ApiQuery({ name: 'archived', required: false, type: Boolean, description: 'Include archived (default: false)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated conversation list',
    schema: apiEnvelopeSchema({ type: 'array', items: ConversationModel }),
  })
  async listConversations(
    @Query(new ZodValidationPipe(conversationQuerySchema)) query: ConversationQueryDto,
    @CurrentUser() user: { id: string },
  ) {
    const result = await this.chatService.listConversations(user.id, query);
    return { data: result.items, error: null, meta: result.meta };
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Conversation details', schema: apiEnvelopeSchema(ConversationModel) })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async getConversation(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const conversation = await this.chatService.getConversation(id, user.id);
    return { data: conversation, error: null };
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max messages to load for branching graph (default: 500, max: 500)' })
  @ApiQuery({ name: 'before', required: false, type: String, description: 'Fetch messages before this ISO 8601 date' })
  @ApiResponse({
    status: 200,
    description: 'Active branch transcript (root → leaf). Meta includes allMessages for branch switching.',
    schema: apiEnvelopeSchema({ type: 'array', items: MessageModel }),
  })
  async getMessages(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(messageQuerySchema)) query: MessageQueryDto,
    @CurrentUser() user: { id: string },
  ) {
    const result = await this.chatService.getMessages(id, user.id, query);
    return { data: result.items, error: null, meta: result.meta };
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Update conversation title' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiBody({ schema: { type: 'object', properties: { title: { type: 'string', maxLength: 200 } }, required: ['title'] } })
  @ApiResponse({ status: 200, description: 'Conversation updated', schema: apiEnvelopeSchema(ConversationModel) })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async updateConversation(
    @Param('id') id: string,
    @Body('title') title: string,
    @CurrentUser() user: { id: string },
  ) {
    const conversation = await this.chatService.updateConversationTitle(id, user.id, title);
    return { data: conversation, error: null };
  }

  @Patch('conversations/:id/active-leaf')
  @ApiOperation({ summary: 'Set active branch by focusing a message (typically an assistant variant)' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiBody({ schema: { type: 'object', properties: { messageId: { type: 'string', format: 'uuid' } }, required: ['messageId'] } })
  @ApiResponse({ status: 200, description: 'Active leaf updated' })
  async setActiveLeaf(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateActiveLeafSchema)) body: UpdateActiveLeafDto,
    @CurrentUser() user: { id: string },
  ) {
    const result = await this.chatService.setActiveLeafFromFocusMessage(id, user.id, body.messageId);
    return { data: result, error: null };
  }

  @Patch('conversations/:id/messages/:messageId')
  @ApiOperation({
    summary: 'Edit a user message (branching resend)',
    description:
      'Updates the user message text. Keeps existing assistant reply(ies) to this user message as branches; removes only continuations under those assistants. Client should then POST /chat/messages with branchFromAssistantMessageId set to the prior assistant on this turn.',
  })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiParam({ name: 'messageId', description: 'User message UUID', format: 'uuid' })
  @ApiBody({ schema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] } })
  @ApiResponse({ status: 200, description: 'Message updated (id, content, conversationId)' })
  async editUserMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body(new ZodValidationPipe(editUserMessageSchema)) body: EditUserMessageDto,
    @CurrentUser() user: { id: string },
  ) {
    const result = await this.chatService.editUserMessageContent(id, user.id, messageId, body.content);
    return { data: result, error: null };
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Conversation deleted' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  async deleteConversation(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.chatService.deleteConversation(id, user.id);
    return { data: { deleted: true }, error: null };
  }

  @Patch('conversations/:id/archive')
  @ApiOperation({ summary: 'Archive a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Conversation archived', schema: apiEnvelopeSchema(ConversationModel) })
  async archiveConversation(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const conversation = await this.chatService.archiveConversation(id, user.id);
    return { data: conversation, error: null };
  }

  @Patch('conversations/:id/unarchive')
  @ApiOperation({ summary: 'Unarchive a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Conversation unarchived', schema: apiEnvelopeSchema(ConversationModel) })
  async unarchiveConversation(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    const conversation = await this.chatService.unarchiveConversation(id, user.id);
    return { data: conversation, error: null };
  }

  @Get('conversations/:id/export')
  @ApiOperation({ summary: 'Export a conversation as JSON or Markdown' })
  @ApiParam({ name: 'id', description: 'Conversation UUID', format: 'uuid' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'md'], description: 'Export format (default: json)' })
  @ApiResponse({ status: 200, description: 'Downloadable conversation export (application/json or text/markdown)' })
  async exportConversation(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(exportConversationSchema)) query: ExportConversationDto,
    @Res() res: Response,
    @CurrentUser() user: { id: string },
  ) {
    const result = await this.chatService.exportConversation(id, user.id, query.format);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  }

  private async persistMessageParts(
    convId: string,
    assistantMessageId: string,
    parts: ExtractedParts,
    progressMap: Map<string, Array<{ label: string; pct: number; ts: number }>>,
  ): Promise<void> {
    for (const t of parts.thinking) {
      await this.chatService.persistThinkingMessage(convId, t.reasoning, assistantMessageId);
    }

    for (const inv of parts.toolInvocations) {
      await this.chatService.persistToolMessage(
        convId,
        assistantMessageId,
        inv.toolCallId,
        inv.toolName,
        inv.args,
        inv.result,
        progressMap.get(inv.toolCallId),
      );
    }
  }

  @Post('messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a message and stream the assistant response via AI SDK protocol',
    description:
      'Accepts an AI SDK-compatible message array and streams the assistant reply through a Mastra Agent ' +
      '(agent layer `@centrai/agent`: Mastra agent + AI SDK v6 UI stream bridge). ' +
      'The response is `text/event-stream` in the AI SDK UI message format.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              role: { type: 'string', enum: ['user', 'assistant', 'system'] },
              content: { type: 'string' },
              parts: { type: 'array', items: { type: 'object' } },
            },
            required: ['role'],
          },
          description: 'AI SDK UI message array',
        },
        conversationId: { type: 'string', format: 'uuid', description: 'Existing conversation ID (optional for new)' },
        agentId: { type: 'string', format: 'uuid', description: 'Agent to converse with' },
        modelId: { type: 'string', description: 'Model id, typically backend/model (e.g. openai/gpt-4o-mini)' },
        modelProvider: { type: 'string', description: 'When modelId has no slash: backend key (openai, anthropic, …)' },
        trigger: { type: 'string', description: 'AI SDK trigger (e.g. regenerate-message)' },
        branchFromAssistantMessageId: {
          type: 'string',
          format: 'uuid',
          description: 'When regenerating: create a sibling assistant under the same user message as this assistant',
        },
        timeZone: {
          type: 'string',
          description:
            'IANA time zone from the browser (e.g. Intl.DateTimeFormat().resolvedOptions().timeZone). Used to format server "now" for the model.',
        },
      },
      required: ['messages'],
    },
  })
  @ApiResponse({ status: 200, description: 'UI message stream (text/event-stream, AI SDK format)' })
  async sendMessage(
    @Req() req: Request,
    @Res() res: Response,
    @CurrentUser() user: { id: string; workspaceId: string },
  ) {
    const {
      messages,
      conversationId,
      agentId,
      modelId,
      modelProvider,
      trigger,
      branchFromAssistantMessageId,
      messageId: messageIdFromBody,
      timeZone: clientTimeZone,
    } = req.body as {
      messages?: unknown[];
      conversationId?: string;
      agentId?: string;
      modelId?: string;
      modelProvider?: string;
      trigger?: string;
      branchFromAssistantMessageId?: string;
      messageId?: string;
      /** IANA time zone from the client (Intl), used to format current time for the model */
      timeZone?: string;
    };

    const { conversationId: convId, isNew } = await this.chatService.ensureConversation(
      user.id,
      user.workspaceId,
      { conversationId, agentId, modelId, modelProvider },
    );

    const conv = await this.chatService.findOwnedConversation(convId, user.id);

    const lastUserMessage = messages?.[messages.length - 1] as
      | {
          role?: string;
          id?: string;
          content?: string;
          parts?: Array<{ type: string; text?: string }>;
        }
      | undefined;

    if (lastUserMessage?.role !== 'user') {
      throw new BadRequestException('Last message must be a user message');
    }

    const content =
      typeof lastUserMessage.content === 'string'
        ? lastUserMessage.content
        : lastUserMessage.parts
            ?.filter((p) => p.type === 'text')
            .map((p) => p.text)
            .join('') ?? '';

    const isRegenerate = trigger === 'regenerate-message' || branchFromAssistantMessageId != null;

    type AssistantPersist =
      | { mode: 'create'; parentUserMessageId: string }
      | { mode: 'update'; assistantMessageId: string };

    let assistantPersist: AssistantPersist;

    if (isRegenerate) {
      if (branchFromAssistantMessageId) {
        assistantPersist = {
          mode: 'create',
          parentUserMessageId: await this.chatService.resolveBranchAssistantParent(
            convId,
            branchFromAssistantMessageId,
          ),
        };
      } else if (typeof messageIdFromBody === 'string') {
        const existing = await this.chatService.findAssistantMessage(messageIdFromBody, convId);
        if (existing?.parentId) {
          assistantPersist = { mode: 'update', assistantMessageId: existing.id };
        } else {
          const uid = typeof lastUserMessage.id === 'string' ? lastUserMessage.id : null;
          if (!uid) {
            throw new BadRequestException('Missing user message id for regeneration');
          }
          assistantPersist = {
            mode: 'create',
            parentUserMessageId: await this.chatService.assertUserMessageInConversation(uid, convId),
          };
        }
      } else {
        const uid = typeof lastUserMessage.id === 'string' ? lastUserMessage.id : null;
        if (!uid) {
          throw new BadRequestException('Missing user message id for regeneration');
        }
        assistantPersist = {
          mode: 'create',
          parentUserMessageId: await this.chatService.assertUserMessageInConversation(uid, convId),
        };
      }
    } else {
      const userRow = await this.chatService.persistUserMessage(
        convId,
        user.id,
        content,
        conv.activeLeafMessageId ?? null,
      );
      assistantPersist = { mode: 'create', parentUserMessageId: userRow.id };
    }

    const { model, definition } = await this.llmService.resolveModelAndDefinition(
      agentId,
      modelId,
      modelProvider,
    );

    const sessionState = definition.addSessionStateToContext
      ? await this.chatService.buildChatSessionState(user.id, clientTimeZone)
      : {};

    const uiMessages: UIMessage[] = (messages ?? []) as UIMessage[];
    const modelMessages = await convertToModelMessages(uiMessages);

    const abortController = new AbortController();
    const stopModelIfClientDisconnects = () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    };
    req.on('close', stopModelIfClientDisconnects);

    // Collect progress events per toolCallId during the stream
    const progressMap = new Map<string, Array<{ label: string; pct: number; ts: number }>>();

    // Step 1 (architecture §3): build the Mastra Agent (tools + memory wired here when needed).
    const agent = await createMastraAgent({
      definition,
      model,
    });

    // Step 2 (architecture §3): stream — Agent.stream → toAISdkStream.
    // User-visible transcript: Prisma conversation messages only (not Mastra memory / PG).
    const { mastraOutput, sdkUiStream } = await createCentrAiChatStream({
      agent,
      messages: modelMessages,
      abortSignal: abortController.signal,
      requestContext: Object.keys(sessionState).length > 0 ? sessionState : undefined,
    });

    const stream = createUIMessageStream({
      originalMessages: uiMessages,
      onFinish: async ({ responseMessage }) => {
        try {
          const parts = extractMessageParts(responseMessage);
          const clientDisconnected = abortController.signal.aborted;
          if (clientDisconnected && parts.text.length === 0 && parts.toolInvocations.length === 0) {
            return;
          }

          let inputTokens: number | undefined;
          let outputTokens: number | undefined;
          try {
            const usage = await mastraOutput.totalUsage;
            inputTokens = usage?.inputTokens ?? undefined;
            outputTokens = usage?.outputTokens ?? undefined;
          } catch {
            // Aborted or failed runs may not resolve usage.
          }
          const tokenCount =
            inputTokens != null && outputTokens != null ? inputTokens + outputTokens : undefined;

          let assistantMessageId: string;
          if (assistantPersist.mode === 'update') {
            const updated = await this.chatService.updateAssistantMessage(
              assistantPersist.assistantMessageId,
              convId,
              parts.text,
              tokenCount,
              inputTokens,
              outputTokens,
            );
            assistantMessageId = updated.id;
          } else {
            const row = await this.chatService.persistAssistantMessage(
              convId,
              parts.text,
              assistantPersist.parentUserMessageId,
              tokenCount,
              inputTokens,
              outputTokens,
            );
            assistantMessageId = row.id;
          }

          await this.persistMessageParts(convId, assistantMessageId, parts, progressMap);

          if (isNew) {
            this.chatService.generateTitleAsync(convId);
          }
        } catch (err) {
          this.logger.error('Failed to persist message parts after UI stream finished', err);
        }
      },
      execute: async ({ writer }) => {
        if (isNew) {
          writer.write({
            type: 'data-conversation',
            data: { conversationId: convId },
          });
        }

        const progressTap = new TransformStream({
          transform(chunk, controller) {
            const c = chunk as { type?: string; data?: { toolCallId?: string; label?: string; pct?: number } };
            if (c?.type === 'data-toolProgress' && c.data?.toolCallId) {
              const { toolCallId, label = '', pct = 0 } = c.data;
              const events = progressMap.get(toolCallId) ?? [];
              if (events.length < 100) {
                events.push({ label, pct, ts: Date.now() });
                progressMap.set(toolCallId, events);
              }
            }
            controller.enqueue(chunk);
          },
        });

        writer.merge(
          (sdkUiStream as ReadableStream<InferUIMessageChunk<UIMessage>>).pipeThrough(
            progressTap as TransformStream<InferUIMessageChunk<UIMessage>, InferUIMessageChunk<UIMessage>>,
          ),
        );
      },
    });

    res.setHeader('X-Conversation-Id', convId);
    pipeUIMessageStreamToResponse({ stream, response: res });
  }
}
