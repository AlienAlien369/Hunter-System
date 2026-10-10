// The languages the app can ask the AI to write in. Anything else falls back to English,
// so a client can never inject free text into the prompt through this field.
const INSTRUCTIONS: Record<string, string> = {
  hi: ' Write every string in simple, natural Hindi in Devanagari script. Keep numbers, XP and day names understandable.',
  'hi-Latn': ' Write every string in casual Hinglish: Hindi written in Latin (English) letters, the way friends text in India. Do not use Devanagari.',
};

/** Extra prompt text for the requested language, or '' for English / unknown values. */
export function languageInstruction(code: unknown): string {
  return typeof code === 'string' && Object.hasOwn(INSTRUCTIONS, code) ? INSTRUCTIONS[code] : '';
}
