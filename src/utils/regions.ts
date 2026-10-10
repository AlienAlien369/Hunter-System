// Country names for pickers, in the reader's language, from the browser's own
// Intl data: no hand-maintained list to go stale. Only real ISO 3166 codes
// are kept (two arbitrary letters resolve to themselves or "Unknown Region").

export interface RegionOption { code: string; name: string }

export function regionOptions(intlLocale: string): RegionOption[] {
  let names: Intl.DisplayNames;
  try { names = new Intl.DisplayNames([intlLocale], { type: 'region' }); } catch { names = new Intl.DisplayNames(['en'], { type: 'region' }); }
  const out: RegionOption[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      const name = names.of(code);
      if (name && name !== code && name !== 'Unknown Region') out.push({ code, name });
    }
  }
  return out.sort((x, y) => x.name.localeCompare(y.name, intlLocale));
}

export function regionName(intlLocale: string, code: string | null | undefined): string {
  if (!code) return '';
  try { return new Intl.DisplayNames([intlLocale], { type: 'region' }).of(code) ?? code; } catch { return code; }
}
