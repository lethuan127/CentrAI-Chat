# @centrai/sdk

TypeScript SDK for the CentrAI-Chat API.

## Installation

```bash
pnpm add @centrai/sdk
```

## Quick Start

```typescript
import { CentrAI } from '@centrai/sdk';

const client = new CentrAI({
  baseUrl: 'http://localhost:4000',
});

// Authenticate
const { user, tokens } = await client.auth.login({
  email: 'admin@example.com',
  password: 'YourPassword1',
});
client.setAccessToken(tokens.accessToken);

// List published agents
const agents = await client.agents.listPublished();
console.log('Available agents:', agents);

// List enabled models
const models = await client.providers.getEnabledModels();
console.log('Available models:', models);
```

## Chat with Streaming

```typescript
import { CentrAI, consumeStream } from '@centrai/sdk';

const client = new CentrAI({
  baseUrl: 'http://localhost:4000',
  accessToken: '<your-jwt-token>',
});

// Send a message and stream the response
const stream = await client.chat.sendMessageStream({
  messages: [{ role: 'user', content: 'Hello, how are you?' }],
  modelId: 'gpt-4o-mini',
});

const fullText = await consumeStream(stream, {
  onToken: (token) => process.stdout.write(token),
  onDone: (text) => console.log('\n--- Done ---'),
  onConversationCreated: (id) => console.log('Conversation:', id),
});
```

## Resources

| Resource | Methods |
|----------|---------|
| `client.auth` | `register`, `login`, `refresh`, `logout`, `me` |
| `client.chat` | `createConversation`, `listConversations`, `getConversation`, `getMessages`, `updateTitle`, `deleteConversation`, `archive`, `unarchive`, `exportConversation`, `sendMessageStream` |
| `client.agents` | `create`, `list`, `listPublished`, `get`, `update`, `publish`, `archive`, `unpublish`, `delete`, `getVersions` |
| `client.providers` | `create`, `list`, `getEnabledModels`, `get`, `update`, `delete`, `testConnection`, `syncModels`, `toggleModel` |
| `client.admin` | `listUsers`, `updateUser`, `getAnalyticsOverview`, `getUsageTrend`, `getAuditLogs`, `getSettings`, `updateSettings`, `getProviderHealth` |

## API Documentation

Interactive Swagger UI is available at `http://localhost:4000/api/docs` when the API is running.

The OpenAPI JSON spec can be downloaded from `http://localhost:4000/api/docs-json`.
