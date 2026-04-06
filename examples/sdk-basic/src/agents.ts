/**
 * Example: Agent management using @centrai/sdk
 *
 * Demonstrates: create agent, publish, list published, get versions.
 * Requires admin role.
 */
import { CentrAI } from '@centrai/sdk';

const BASE_URL = process.env.CENTRAI_URL ?? 'http://localhost:4000';
const EMAIL = process.env.CENTRAI_EMAIL ?? 'admin@centrai.local';
const PASSWORD = process.env.CENTRAI_PASSWORD ?? 'Admin123!';

async function main() {
  const client = new CentrAI({ baseUrl: BASE_URL });

  // ── Login as admin ──
  const { tokens } = await client.auth.login({ email: EMAIL, password: PASSWORD });
  client.setAccessToken(tokens.accessToken);
  console.log('Authenticated');

  // ── Create an agent ──
  const agent = await client.agents.create({
    name: 'SDK Example Agent',
    description: 'A helpful assistant created via the SDK',
    role: 'You are a helpful assistant.',
    instructions: 'Be concise and accurate. Answer questions to the best of your ability.',
    tags: ['example', 'sdk'],
  });
  console.log(`Created agent: ${agent.name} (${agent.id}), status: ${agent.status}`);

  // ── Publish the agent ──
  const published = await client.agents.publish(agent.id);
  console.log(`Published agent: ${published.name}, status: ${published.status}`);

  // ── List published agents (end-user perspective) ──
  const publishedList = await client.agents.listPublished();
  console.log(`Published agents (${publishedList.length}):`);
  for (const a of publishedList) {
    console.log(`  - ${a.name} (${a.id})`);
  }

  // ── Get version history ──
  const versions = await client.agents.getVersions(agent.id);
  console.log(`Versions (${versions.length}):`);
  for (const v of versions) {
    console.log(`  v${v.version}: ${v.name} — ${v.changelog ?? 'initial'}`);
  }

  // ── Clean up: archive and delete ──
  await client.agents.archive(agent.id);
  await client.agents.delete(agent.id);
  console.log('Agent archived and deleted');
}

main().catch(console.error);
