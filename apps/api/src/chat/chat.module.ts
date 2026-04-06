import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProviderModule } from '../provider/provider.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { MastraAgentRuntimeStorage } from './mastra-agent-runtime.storage';

@Module({
  imports: [PrismaModule, ProviderModule],
  controllers: [ChatController],
  providers: [ChatService, MastraAgentRuntimeStorage],
  exports: [ChatService, MastraAgentRuntimeStorage],
})
export class ChatModule {}
