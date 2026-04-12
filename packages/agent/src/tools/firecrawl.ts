import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Tool as MastraTool } from '@mastra/core/tools';
import { FirecrawlAppV1 } from '@mendable/firecrawl-js';

import { CentrAITools } from './centrai-tools.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface FirecrawlToolsConfig {
  /**
   * Firecrawl API key. Falls back to the `FIRECRAWL_API_KEY` environment variable.
   */
  apiKey?: string;
  /** Enable the `firecrawl_scrape_website` tool (default: true). */
  enableScrape?: boolean;
  /** Enable the `firecrawl_crawl_website` tool (default: false). */
  enableCrawl?: boolean;
  /** Enable the `firecrawl_map_website` tool (default: false). */
  enableMapping?: boolean;
  /** Enable the `firecrawl_search_web` tool (default: false). */
  enableSearch?: boolean;
  /** When true, enables all tools regardless of the individual flags. */
  all?: boolean;
  /**
   * Output formats to request from Firecrawl.
   * Valid values: `'markdown'`, `'html'`, `'rawHtml'`, `'links'`, `'screenshot'`, etc.
   */
  formats?: string[];
  /** Maximum number of pages when crawling / maximum results when searching (default: 10). */
  limit?: number;
  /** Polling interval in seconds for async crawl jobs (default: 30). */
  pollInterval?: number;
  /** Extra params merged into every `search` call. */
  searchParams?: Record<string, unknown>;
  /** Firecrawl API base URL (default: `https://api.firecrawl.dev`). */
  apiUrl?: string;
}

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

/**
 * Toolkit that mirrors the agno `FirecrawlTools` Python class.
 *
 * Instantiate with config, then call `getTools()` to obtain the Mastra
 * `Tool` instances that should be registered for an agent.
 *
 * @example
 * ```ts
 * const tools = new FirecrawlTools({ enableScrape: true, enableSearch: true });
 * const mastraTools = tools.getTools();
 * ```
 */
export class FirecrawlTools extends CentrAITools {
  readonly instructions =
    'Use the Firecrawl tools to retrieve information from the web. ' +
    'Call `firecrawl_scrape_website` to extract clean content from a single URL. ' +
    'Call `firecrawl_crawl_website` to follow links and collect multiple pages from a site. ' +
    'Call `firecrawl_map_website` to enumerate all URLs on a domain. ' +
    'Call `firecrawl_search_web` to search the public web and return structured results. ' +
    'Always prefer scraping or searching over guessing at content.';
  private readonly app: FirecrawlAppV1;
  private readonly formats?: string[];
  private readonly limit: number;
  private readonly pollInterval: number;
  private readonly searchParams?: Record<string, unknown>;

  private readonly enableScrape: boolean;
  private readonly enableCrawl: boolean;
  private readonly enableMapping: boolean;
  private readonly enableSearch: boolean;

  constructor(config: FirecrawlToolsConfig = {}) {
    super();
    const apiKey = config.apiKey ?? process.env['FIRECRAWL_API_KEY'];
    if (!apiKey) {
      console.error(
        'FIRECRAWL_API_KEY not set. Please set the FIRECRAWL_API_KEY environment variable.',
      );
    }

    this.app = new FirecrawlAppV1({
      apiKey: apiKey ?? '',
      apiUrl: config.apiUrl ?? 'https://api.firecrawl.dev',
    });

    this.formats = config.formats;
    this.limit = config.limit ?? 10;
    this.pollInterval = config.pollInterval ?? 30;
    this.searchParams = config.searchParams;

    const all = config.all ?? false;
    this.enableScrape = all || (config.enableScrape ?? true);
    this.enableCrawl = all || (config.enableCrawl ?? false);
    this.enableMapping = all || (config.enableMapping ?? false);
    this.enableSearch = all || (config.enableSearch ?? false);
  }

  // -------------------------------------------------------------------------
  // Individual tool factories
  // -------------------------------------------------------------------------

  /**
   * Returns a Mastra tool that scrapes a single URL via Firecrawl.
   */
  scrapeWebsite(): MastraTool {
    const { app, formats } = this;

    return createTool({
      id: 'firecrawl_scrape_website',
      description: 'Scrape a website using Firecrawl and return its content.',
      inputSchema: z.object({
        url: z.string().url().describe('The URL to scrape.'),
      }),
      execute: async ({ url }) => {
        const params: Record<string, unknown> = {};
        if (formats?.length) {
          params['formats'] = formats;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await app.scrapeUrl(url, params as any);
        return JSON.stringify(result, safeReplacer);
      },
    }) as MastraTool;
  }

  /**
   * Returns a Mastra tool that crawls a website (follows links) via Firecrawl.
   */
  crawlWebsite(): MastraTool {
    const { app, formats, limit, pollInterval } = this;

    return createTool({
      id: 'firecrawl_crawl_website',
      description: 'Crawl a website (follow links) using Firecrawl and return all scraped pages.',
      inputSchema: z.object({
        url: z.string().url().describe('The root URL to start crawling from.'),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Maximum number of pages to crawl. Overrides the toolkit default.'),
      }),
      execute: async ({ url, limit: inputLimit }) => {
        const params: Record<string, unknown> = {
          limit: inputLimit ?? limit,
        };

        if (formats?.length) {
          params['scrapeOptions'] = { formats };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await app.crawlUrl(url, params as any, pollInterval);
        return JSON.stringify(result, safeReplacer);
      },
    }) as MastraTool;
  }

  /**
   * Returns a Mastra tool that maps all URLs found on a website via Firecrawl.
   */
  mapWebsite(): MastraTool {
    const { app } = this;

    return createTool({
      id: 'firecrawl_map_website',
      description: 'Map all URLs on a website using Firecrawl and return the list of links.',
      inputSchema: z.object({
        url: z.string().url().describe('The URL to map.'),
      }),
      execute: async ({ url }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await app.mapUrl(url, {} as any);
        return JSON.stringify(result, safeReplacer);
      },
    }) as MastraTool;
  }

  /**
   * Returns a Mastra tool that performs a web search via Firecrawl.
   */
  searchWeb(): MastraTool {
    const { app, formats, limit, searchParams } = this;

    return createTool({
      id: 'firecrawl_search_web',
      description: 'Search the web using Firecrawl and return structured results.',
      inputSchema: z.object({
        query: z.string().describe('The search query.'),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Maximum number of results to return. Overrides the toolkit default.'),
      }),
      execute: async ({ query, limit: inputLimit }) => {
        const params: Record<string, unknown> = {
          limit: inputLimit ?? limit,
          ...(searchParams ?? {}),
        };

        if (formats?.length) {
          params['scrapeOptions'] = { formats };
        }

        const result = await app.search(query, params);

        if ('success' in result) {
          if (result.success) {
            return JSON.stringify(result.data, safeReplacer);
          }
          const errMsg = 'error' in result ? String(result.error) : 'Unknown error';
          return `Error searching with the Firecrawl tool: ${errMsg}`;
        }

        return JSON.stringify(result, safeReplacer);
      },
    }) as MastraTool;
  }

  // -------------------------------------------------------------------------
  // Bulk accessor
  // -------------------------------------------------------------------------

  /**
   * Returns all enabled `MastraTool` instances based on the config flags
   * passed to the constructor — implements {@link CentrAITools.toMastraTools}.
   */
  toMastraTools(): MastraTool[] {
    const tools: MastraTool[] = [];
    if (this.enableScrape) tools.push(this.scrapeWebsite());
    if (this.enableCrawl) tools.push(this.crawlWebsite());
    if (this.enableMapping) tools.push(this.mapWebsite());
    if (this.enableSearch) tools.push(this.searchWeb());
    return tools;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * JSON replacer that converts non-serialisable values to strings, mirroring
 * Python's `CustomJSONEncoder`.
 */
function safeReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}
