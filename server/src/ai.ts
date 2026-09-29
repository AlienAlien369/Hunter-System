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
 * (404 "no longer available to new users") and popular models are often
 * briefly overloaded (503 "high demand") or rate-limited (429), so those
 * errors move on to the next candidate instead of failing the feature.
 */
export function geminiModels(): string[] {
  // Flash-Lite first: fast, cheap, built for structured output, and far less
  // often overloaded than the flagship Flash models, which follow as fallbacks.
  return [...new Set([process.env.GEMINI_MODEL, 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'].filter((m): m is string => !!m))];
}

/**
 * Keep thinking short: these are simple structured-extraction tasks, and
 * default "dynamic"/high thinking made responses slow enough to time out.
 * gemini-3.8-flash doesn't support "minimal", so it gets "low".
 */
export const thinkingLevelFor = (model: string) => (model.includes('3.8') ? 'low' : 'minimal');

/** Statuses where another attempt (same model after a pause, or another model) may succeed. */
const RETRYABLE = new Set([404, 429, 500, 503]);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/** Total time budget across all Gemini attempts, so the user never waits minutes. */
const GEMINI_BUDGET_MS = 50_000;

/** Gemini: structure is enforced with responseMimeType + responseSchema. */
async function gemini(opts: StructuredRequest, key: string): Promise<unknown | null> {
  const deadline = Date.now() + GEMINI_BUDGET_MS;
  for (const model of geminiModels()) {
    let thinking = true;
    // Overload/rate-limit: one quick retry on the same model, then the next model.
    for (let attempt = 1; attempt <= 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 3000) return null;
      const r = await geminiOnce(opts, key, model, thinking, Math.min(opts.timeoutMs ?? 25000, remaining));
      if (r.ok) return r.value;
      console.error(`Gemini ${model} attempt ${attempt} failed: ${r.error}`);
      if (r.status === 400 && thinking) {
        thinking = false; // this model may not accept the thinking setting — retry without it
        continue;
      }
      if (!r.retryable) return null; // e.g. invalid key or bad request — other models won't help
      if (r.status !== 503 && r.status !== 429) break; // gone/timeout/garbled → next model
      if (attempt === 1) await sleep(1500);
    }
  }
  return null;
}

type Attempt = { ok: true; value: unknown } | { ok: false; retryable: boolean; status?: number; error: string };

async function geminiOnce(opts: StructuredRequest, key: string, model: string, thinking: boolean, timeoutMs: number): Promise<Attempt> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: 'user', parts: [{ text: opts.prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: toGeminiSchema(opts.schema),
          maxOutputTokens: 8192,
          ...(thinking ? { thinkingConfig: { thinkingLevel: thinkingLevelFor(model) } } : {}),
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 300);
      return { ok: false, retryable: RETRYABLE.has(res.status), status: res.status, error: `${res.status} ${body}` };
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.filter(p => !p.thought).map(p => p.text ?? '').join('') ?? '';
    if (!text) return { ok: false, retryable: true, error: 'empty response' };
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    // Timeouts, network errors and malformed JSON: worth trying another model.
    return { ok: false, retryable: true, error: (error as Error).message };
  }
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
