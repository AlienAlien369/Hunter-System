import { LOCALES, useLocaleStore, useT, type LocaleCode } from '../i18n';

/** Compact language switcher. `variant="inline"` is for Settings, `"corner"` for sign-in screens. */
export default function LanguagePicker({ variant = 'corner' }: { variant?: 'corner' | 'inline' }) {
  const locale = useLocaleStore(s => s.locale);
  const setLocale = useLocaleStore(s => s.setLocale);
  const t = useT();
  return (
    <label className={variant === 'corner' ? 'inline-flex items-center gap-2 text-[11px] font-mono text-gray-400' : 'inline-flex items-center gap-3 text-sm font-mono text-gray-300'}>
      <span aria-hidden>🌐</span>
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={locale}
        onChange={e => setLocale(e.target.value as LocaleCode)}
        aria-label={t('common.language')}
        className="bg-[#0d1117] border border-purple-500/30 rounded-md px-2 py-1 text-gray-200 focus:outline-none focus:border-purple-400"
      >
        {LOCALES.map(l => <option key={l.code} value={l.code} lang={l.lang}>{l.label}</option>)}
      </select>
    </label>
  );
}
