// A hint, never a gate: does this visitor look like they are in India? Used
// only to *offer* the India-focused page. Language and timezone only, no IP.

export function looksIndian(languages: readonly string[], timeZone: string): boolean {
  if (timeZone === 'Asia/Kolkata' || timeZone === 'Asia/Calcutta') return true;
  return languages.some(l => /^hi(-|$)/i.test(l) || /-IN$/i.test(l));
}

export function browserLooksIndian(): boolean {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    return looksIndian(langs.filter(Boolean), Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return false;
  }
}
