import { Logger, Module, OnModuleInit } from '@nestjs/common';

import { loadMcpConfig, registerMcpToolkitsFromConfig } from '@centrai/agent';

import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule implements OnModuleInit {
  private readonly logger = new Logger(AgentModule.name);

  async onModuleInit(): Promise<void> {
    const mcpConfig = await loadMcpConfig();

    if (!mcpConfig) {
      this.logger.debug(
        'No MCP config found (.centrai/.mcp.json or CENTRAI_MCP_PATH) — skipping MCP toolkit registration',
      );
      return;
    }

    const serverNames = Object.keys(mcpConfig.mcpServers);
    this.logger.log(`Registering MCP toolkits: ${serverNames.join(', ')}`);

    try {
      await registerMcpToolkitsFromConfig(mcpConfig);
      this.logger.log(`MCP toolkits registered (${serverNames.length})`);
    } catch (err: unknown) {
      this.logger.error(
        `Failed to register MCP toolkits — agents with MCP tool refs will be unavailable`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
