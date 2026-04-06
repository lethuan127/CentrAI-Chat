import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'CentrAI-Chat',
    },
    links: [
      {
        text: 'Docs',
        url: '/docs',
        active: 'nested-url',
      },
      {
        text: 'API Reference',
        url: '/docs/api-reference',
      },
      {
        text: 'GitHub',
        url: 'https://github.com/lethuan127/CentrAI-Chat',
        external: true,
      },
    ],
  };
}
