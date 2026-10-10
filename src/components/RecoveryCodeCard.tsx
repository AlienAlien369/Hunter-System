import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useT, useLocaleStore, formatDate } from '../i18n';
import { Btn, inputCls } from './hunter/ui';

/** Settings → Account: single-use recovery code (Hunter has no email reset). */
export default function RecoveryCodeCard() {
  const t = useT();
  const locale = useLocaleStore(s => s.locale);
  const [createdAt, setCreatedAt] = useState<string | null | undefined>(undefined);
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { api.getRecoveryStatus().then(r => setCreatedAt(r.createdAt)).catch(() => setCreatedAt(null)); }, []);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const r = await api.createRecoveryCode(password);
      setCode(r.code);
      setCreatedAt(new Date().toISOString());
      setAsking(false);
      setPassword('');
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const copy = () => navigator.clipboard.writeText(code).then(() => setCopied(true)).catch(() => {});

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${createdAt === null ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-purple-500/15 bg-[#161b22]/80'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-white font-mono">{t('rec.title')}</p>
          <p className="text-[11px] text-gray-500 font-mono">
            {createdAt === null
              ? t('rec.none')
              : createdAt
                ? t('rec.set', { date: formatDate(locale, createdAt) })
                : t('rec.hint')}
          </p>
        </div>
        {!asking && !code && <Btn variant="ghost" onClick={() => setAsking(true)}>{createdAt ? t('rec.new') : t('rec.create')}</Btn>}
      </div>
      {asking && (
        <form onSubmit={generate} className="flex flex-wrap gap-2">
          <input type="password" autoComplete="current-password" aria-label={t('rec.pwAria')} placeholder={t('rec.pwPh')} className={`${inputCls} flex-1 min-w-[10rem]`} value={password} onChange={e => setPassword(e.target.value)} />
          <Btn type="submit" disabled={!password}>{t('rec.generate')}</Btn>
          <Btn variant="ghost" onClick={() => { setAsking(false); setError(''); }}>{t('rec.cancel')}</Btn>
        </form>
      )}
      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
      {code && (
        <div className="space-y-2">
          <p className="font-display text-xl tracking-[0.2em] text-gold text-center select-all break-all">{code}</p>
          <p className="text-[11px] text-yellow-300 font-mono text-center">{t('rec.save')}</p>
          <div className="flex justify-center gap-2">
            <Btn variant="ghost" onClick={copy}>{copied ? t('rec.copied') : t('rec.copy')}</Btn>
            <Btn variant="ghost" onClick={() => setCode('')}>{t('rec.saved')}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
