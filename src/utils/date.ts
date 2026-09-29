// Calendar days in the hunter's own timezone. The server computes "today"
// from the X-Timezone header the API client sends, so client and server agree
// on when a day starts (local midnight, not UTC midnight).

/** YYYY-MM-DD of `d` in the browser's local timezone. */
export function localDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The browser's IANA timezone (e.g. "Asia/Kolkata"), or UTC if unavailable. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
