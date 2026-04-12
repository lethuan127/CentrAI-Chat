import type { Tool as MastraTool } from '@mastra/core/tools';

/**
 * Abstract base class for all CentrAI toolkit implementations.
 *
 * Every toolkit must declare:
 * - `instructions` — a plain-text description of what the toolkit does and
 *   when the agent should use it. This is injected into the system prompt so
 *   the LLM understands the toolkit's purpose before seeing individual tools.
 * - `toMastraTools()` — returns the list of enabled {@link MastraTool}
 *   instances that should be registered with the Mastra agent.
 *
 * @example
 * ```ts
 * class MyTools extends CentrAITools {
 *   readonly instructions =
 *     'Use these tools to interact with the My API. Prefer search before fetch.';
 *
 *   toMastraTools() {
 *     return [this.fetchItem(), this.searchItems()];
 *   }
 * }
 * ```
 */
export abstract class CentrAITools {
  /**
   * Name of the toolkit.
   */
  abstract readonly name: string;

  /**
   * Human-readable instructions for the LLM describing this toolkit's purpose
   * and usage guidelines. Injected into the agent system prompt.
   */
  abstract readonly instructions: string;

  /**
   * Returns the list of enabled Mastra {@link MastraTool} instances produced
   * by this toolkit.
   */
  abstract toMastraTools(): MastraTool[];
}
