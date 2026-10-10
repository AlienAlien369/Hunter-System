import { useMemo, useState } from 'react';
import { api } from '../lib/api';
import { localeInfo, useLocaleStore, useT } from '../i18n';
import { regionOptions } from '../utils/regions';

/** A country select that saves to the hunter's profile. Used in Settings and when the country leaderboard needs one. */
export default function CountryPicker({ value, onSaved }: { value?: string | null; onSaved?: (region: string) => void }) {
  const t = useT();
  const locale = useLocaleStore(s => s.locale);
  const options = useMemo(() => regionOptions(localeInfo(locale).intl), [locale]);
  const [saved, setSaved] = useState(value ?? '');
  const [error, setError] = useState('');

  const choose = async (code: string) => {
    if (!code) return;
    setError('');
    try {
      const r = await api.setRegion(code);
      setSaved(r.region);
      onSaved?.(r.region);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div>
      <label className="inline-flex items-center gap-3 text-sm font-mono text-gray-300">
        <span>{t('country.label')}</span>
        <select
          value={saved}
          onChange={e => choose(e.target.value)}
          className="bg-[#0d1117] border border-purple-500/30 rounded-md px-2 py-1 text-gray-200 max-w-[14rem]"
        >
          <option value="">{t('country.choose')}</option>
          {options.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="mt-1 text-xs font-mono text-red-400">{error}</p>}
    </div>
  );
}
