import { docs } from '@/.source';
import { loader } from 'fumadocs-core/source';

// fumadocs-mdx v11 returns `files` as a lazy function; fumadocs-core v15 expects an array
const mdxSource = docs.toFumadocsSource() as { files: unknown };
const resolvedFiles = typeof mdxSource.files === 'function'
  ? (mdxSource.files as () => unknown[])()
  : mdxSource.files;

export const source = loader({
  baseUrl: '/docs',
  source: { files: resolvedFiles } as Parameters<typeof loader>[0]['source'],
});
