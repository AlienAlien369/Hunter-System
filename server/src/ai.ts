// Minimal AI service. Used only where it adds value (interpreting free text):
// unplanned-activity analysis and onboarding routine suggestions.
// It never touches XP or the database — callers validate the output and the
// rules engine decides. Any failure (no key, timeout, bad output) returns
// null, and every caller has a deterministic manual fallback.

const API_URL = 'https://api.anthropic.com/v1/messages';

export function aiAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Ask the model for a structured object. The schema is enforced by forcing a
 * single tool call; the tool's input is the structured output.
 */
export async function structuredCompletion(opts: {
  system: string;
  prompt: string;
  toolName: string;
  schema: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<unknown | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: opts.system,
        messages: [{ role: 'user', content: opts.prompt }],
        tools: [{ name: opts.toolName, description: 'Return the structured result.', input_schema: opts.schema }],
        tool_choice: { type: 'tool', name: opts.toolName },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15000),
    });
    if (!res.ok) {
      console.error('AI request failed:', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = (await res.json()) as { content?: { type: string; input?: unknown }[] };
    return data.content?.find(b => b.type === 'tool_use')?.input ?? null;
  } catch (error) {
    console.error('AI request error:', (error as Error).message);
    return null;
  }
}
