import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Btn, inputCls } from './hunter/ui';

/** Settings → Account: single-use recovery code (Hunter has no email reset). */
export default function RecoveryCodeCard() {
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
          <p className="text-sm text-white font-mono">Recovery code</p>
          <p className="text-[11px] text-gray-500 font-mono">
            {createdAt === null
              ? "⚠ No recovery code yet — if you forget your password, there's no other way back in."
              : createdAt
                ? `Set ${new Date(createdAt).toLocaleDateString()}. Use it on the login screen via "Forgot password?". Making a new one replaces it.`
                : 'Lets you reset a forgotten password.'}
          </p>
        </div>
        {!asking && !code && <Btn variant="ghost" onClick={() => setAsking(true)}>{createdAt ? 'NEW CODE' : 'CREATE CODE'}</Btn>}
      </div>
      {asking && (
        <form onSubmit={generate} className="flex flex-wrap gap-2">
          <input type="password" autoComplete="current-password" aria-label="Your password" placeholder="Confirm your password" className={`${inputCls} flex-1 min-w-[10rem]`} value={password} onChange={e => setPassword(e.target.value)} />
          <Btn type="submit" disabled={!password}>GENERATE</Btn>
          <Btn variant="ghost" onClick={() => { setAsking(false); setError(''); }}>CANCEL</Btn>
        </form>
      )}
      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
      {code && (
        <div className="space-y-2">
          <p className="font-display text-xl tracking-[0.2em] text-gold text-center select-all break-all">{code}</p>
          <p className="text-[11px] text-yellow-300 font-mono text-center">Save this somewhere safe now — it won't be shown again and works once.</p>
          <div className="flex justify-center gap-2">
            <Btn variant="ghost" onClick={copy}>{copied ? 'COPIED ✓' : 'COPY'}</Btn>
            <Btn variant="ghost" onClick={() => setCode('')}>I SAVED IT</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
