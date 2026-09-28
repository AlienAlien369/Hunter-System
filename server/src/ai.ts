// Minimal AI service. Used only where it adds value (interpreting free text):
// unplanned-activity analysis, onboarding routine suggestions and the module
// builder. It never touches XP or the database — callers validate the output
// and the rules engine decides. Any failure (no key, timeout, bad output)
// returns null, and every caller has a deterministic manual fallback.
//
// Providers, in order: Anthropic (ANTHROPIC_API_KEY), then Google Gemini
// (GOOGLE_API_KEY or GEMINI_API_KEY). Gemini is used when no Anthropic key is
// set, and also as a fallback if the Anthropic call fails.

type Schema = Record<string, unknown>;

interface StructuredRequest {
  system: string;
  prompt: string;
  toolName: string;
  schema: Schema;
  timeoutMs?: number;
}

const googleKey = () => process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

export function aiAvailable(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || googleKey());
}

/** Ask the configured provider(s) for an object matching `schema`. */
export async function structuredCompletion(opts: StructuredRequest): Promise<unknown | null> {
  if (process.env.ANTHROPIC_API_KEY) {
    const out = await anthropic(opts, process.env.ANTHROPIC_API_KEY);
    if (out !== null) return out;
  }
  const gkey = googleKey();
  if (gkey) return gemini(opts, gkey);
  return null;
}

/** Anthropic: structure is enforced by forcing a single tool call. */
async function anthropic(opts: StructuredRequest, key: string): Promise<unknown | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
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
      console.error('Anthropic request failed:', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = (await res.json()) as { content?: { type: string; input?: unknown }[] };
    return data.content?.find(b => b.type === 'tool_use')?.input ?? null;
  } catch (error) {
    console.error('Anthropic request error:', (error as Error).message);
    return null;
  }
}

/**
 * Models to try, in order. Google retires older models for new API keys
 * (e.g. gemini-2.5-flash → 404 "no longer available to new users"), so a
 * 404 moves on to the next candidate instead of failing the feature.
 */
export function geminiModels(): string[] {
  return [...new Set([process.env.GEMINI_MODEL, 'gemini-3.8-flash', 'gemini-3.5-flash'].filter((m): m is string => !!m))];
}

/** Gemini: structure is enforced with responseMimeType + responseSchema. */
async function gemini(opts: StructuredRequest, key: string): Promise<unknown | null> {
  for (const model of geminiModels()) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
          // Newer models spend output tokens on thinking first, so leave generous headroom.
          generationConfig: { responseMimeType: 'application/json', responseSchema: toGeminiSchema(opts.schema), maxOutputTokens: 8192 },
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30000),
      });
      if (res.status === 404) {
        console.error(`Gemini model ${model} unavailable, trying next:`, (await res.text().catch(() => '')).slice(0, 200));
        continue;
      }
      if (!res.ok) {
        console.error(`Gemini request failed (${model}):`, res.status, await res.text().catch(() => ''));
        return null;
      }
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text ?? '').join('') ?? '';
      return text ? JSON.parse(text) : null;
    } catch (error) {
      console.error(`Gemini request error (${model}):`, (error as Error).message);
      return null;
    }
  }
  return null;
}

/**
 * Convert our JSON-Schema-style tool schemas to Gemini's OpenAPI subset:
 * uppercase types, and enums only on strings (other enums are dropped — the
 * rules layer validates every value anyway).
 */
export function toGeminiSchema(s: Schema): Schema {
  const out: Schema = {};
  const type = typeof s.type === 'string' ? s.type : undefined;
  if (type) out.type = type.toUpperCase();
  if (typeof s.description === 'string') out.description = s.description;
  if (Array.isArray(s.enum) && type === 'string') out.enum = s.enum;
  if (Array.isArray(s.required)) out.required = s.required;
  if (s.items && typeof s.items === 'object') out.items = toGeminiSchema(s.items as Schema);
  if (s.properties && typeof s.properties === 'object') {
    out.properties = Object.fromEntries(
      Object.entries(s.properties as Record<string, Schema>).map(([k, v]) => [k, toGeminiSchema(v)]),
    );
  }
  return out;
}
