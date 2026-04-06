/**
 * Example: Chat with streaming using @centrai/sdk
 *
 * Demonstrates: send a message, stream the response token-by-token.
 */
import { CentrAI, consumeStream } from '@centrai/sdk';

const BASE_URL = process.env.CENTRAI_URL ?? 'http://localhost:4000';
const EMAIL = process.env.CENTRAI_EMAIL ?? 'admin@centrai.local';
const PASSWORD = process.env.CENTRAI_PASSWORD ?? 'Admin123!';

async function main() {
  const client = new CentrAI({ baseUrl: BASE_URL });

  // ── Login ──
  const { tokens } = await client.auth.login({ email: EMAIL, password: PASSWORD });
  client.setAccessToken(tokens.accessToken);
  console.log('Authenticated\n');

  // ── List available models ──
  const modelGroups = await client.providers.getEnabledModels();
  if (modelGroups.length === 0) {
    console.log('No models available. Configure a provider in the admin UI first.');
    return;
  }
  const firstModel = modelGroups[0].models[0];
  console.log(`Using model: ${firstModel.name} (${firstModel.modelId})`);
  console.log('---');

  // ── Send a message and stream the response ──
  let conversationId: string | undefined;

  const stream = await client.chat.sendMessageStream({
    messages: [{ role: 'user', content: 'Explain what CentrAI-Chat is in two sentences.' }],
    modelId: firstModel.modelId,
  });

  console.log('Assistant: ');
  await consumeStream(stream, {
    onToken: (token) => process.stdout.write(token),
    onConversationCreated: (id) => {
      conversationId = id;
    },
    onDone: () => console.log('\n---'),
  });

  // ── Send a follow-up in the same conversation ──
  if (conversationId) {
    console.log(`\nConversation ID: ${conversationId}`);
    console.log('Sending follow-up...\n');

    const followUpStream = await client.chat.sendMessageStream({
      messages: [
        { role: 'user', content: 'Explain what CentrAI-Chat is in two sentences.' },
        { role: 'assistant', content: '(previous response)' },
        { role: 'user', content: 'Now explain it in one word.' },
      ],
      conversationId,
      modelId: firstModel.modelId,
    });

    console.log('Assistant: ');
    await consumeStream(followUpStream, {
      onToken: (token) => process.stdout.write(token),
      onDone: () => console.log('\n---'),
    });

    // ── List conversations ──
    const { items } = await client.chat.listConversations({ limit: 5 });
    console.log(`\nRecent conversations (${items.length}):`);
    for (const conv of items) {
      console.log(`  - ${conv.title ?? '(untitled)'} (${conv.id})`);
    }
  }
}

main().catch(console.error);
