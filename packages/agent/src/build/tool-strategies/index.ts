import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Tool as MastraTool } from '@mastra/core/tools';

import type { ToolProvider } from '../mastra-tool.factory.js';

/**
 * Example built-in strategy — register under the same name in `createToolProviderRegistry`.
 */
export const echoToolProvider: ToolProvider = () =>
  createTool({
    id: 'echo',
    description: 'Echoes input back (example built-in tool).',
    inputSchema: z.object({ message: z.string() }),
    execute: async ({ message }) => ({ echo: message }),
  }) as MastraTool;
