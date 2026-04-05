import {
  Controller,
  Post,
  Param,
  Body,
  Res,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { sendMessageSchema } from '@centrai/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ChatService } from './chat.service';
import type { SendMessageDto } from '@centrai/types';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('messages')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(sendMessageSchema))
  @ApiOperation({
    summary: 'Send a message and stream the assistant response via SSE',
  })
  @ApiResponse({ status: 200, description: 'SSE stream of chat events (text/event-stream)' })
  async sendMessage(
    @Body() dto: SendMessageDto,
    @CurrentUser() user: { id: string },
    @Res() res: Response,
  ) {
    await this.chatService.streamMessage(user.id, dto, res);
  }

  @Post('messages/:messageId/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop an active streaming response' })
  @ApiResponse({ status: 200, description: 'Stream stopped' })
  @ApiResponse({ status: 404, description: 'No active stream for this message' })
  stopStream(@Param('messageId') messageId: string) {
    this.chatService.stopStream(messageId);
    return { data: { stopped: true }, error: null };
  }
}
