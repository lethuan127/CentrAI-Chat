import type { Job } from 'bullmq';
import type { GenerateTitlePayload } from '../queues/chat.queue.js';

export async function processGenerateTitle(
  job: Job<GenerateTitlePayload>,
  prisma: { conversation: any; message: any },
): Promise<void> {
  const { conversationId } = job.data;

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 4,
    select: { role: true, content: true },
  });

  if (messages.length < 2) return;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId },
    select: { title: true, modelId: true },
  });

  if (conversation?.title) return;

  const model = conversation?.modelId ?? process.env.DEFAULT_MODEL ?? 'gpt-4o-mini';
  const baseUrl = process.env.PROVIDER_BASE_URL ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';
  const apiKey = process.env.PROVIDER_API_KEY ?? process.env.OPENAI_API_KEY;

  const prompt = [
    {
      role: 'system' as const,
      content: 'Generate a concise title (max 6 words) for this conversation. Return ONLY the title text, no quotes or formatting.',
    },
    {
      role: 'user' as const,
      content: messages
        .map((m: { role: string; content: string }) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join('\n'),
    },
  ];

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: prompt,
        temperature: 0.3,
        max_tokens: 30,
      }),
    });

    if (!response.ok) {
      throw new Error(`Provider returned ${response.status}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const title = data.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, '');

    if (title) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[generate-title] Failed for ${conversationId}: ${message}`);
    throw err;
  }
}
