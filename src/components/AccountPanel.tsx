import { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { Btn, inputCls } from './hunter/ui';

/** Settings → Account: change password, and permanently delete the account. */
export default function AccountPanel() {
  const user = useAuthStore(s => s.user);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [delPassword, setDelPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [delError, setDelError] = useState('');
  const [busy, setBusy] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setPwMsg(null);
    try {
      await api.changePassword(current, next);
      setCurrent('');
      setNext('');
      setPwMsg({ ok: true, text: 'Password updated.' });
    } catch (err) {
      setPwMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    setDelError('');
    try {
      await api.deleteAccount(delPassword, confirm);
      try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage unavailable */ }
      window.location.href = '/login';
    } catch (err) {
      setDelError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0d1117]/80 backdrop-blur-xl rounded-xl border border-accent-border p-5 space-y-5"
    >
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center text-sm">🔐</div>
        <div>
          <h2 className="text-white font-display font-bold tracking-wider">ACCOUNT</h2>
          <p className="text-xs text-gray-500 font-mono">Signed in as {user?.username}</p>
        </div>
      </div>

      <form onSubmit={changePassword} className="space-y-3">
        <p className="text-sm text-white font-mono">Change password</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="password" autoComplete="current-password" aria-label="Current password" placeholder="Current password" className={inputCls} value={current} onChange={e => setCurrent(e.target.value)} required />
          <input type="password" autoComplete="new-password" aria-label="New password" placeholder="New password (6+ characters)" className={inputCls} value={next} onChange={e => setNext(e.target.value)} minLength={6} required />
        </div>
        <div className="flex items-center gap-3">
          <Btn type="submit" disabled={busy || !current || next.length < 6}>UPDATE PASSWORD</Btn>
          {pwMsg && <span className={`text-xs font-mono ${pwMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{pwMsg.text}</span>}
        </div>
      </form>

      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-red-300 font-mono">Delete account</p>
            <p className="text-[11px] text-gray-500 font-mono">Permanently deletes your hunter, XP, quests, modules and history. This cannot be undone.</p>
          </div>
          {!showDelete && <Btn variant="danger" onClick={() => setShowDelete(true)}>DELETE ACCOUNT…</Btn>}
        </div>
        {showDelete && (
          <div className="space-y-2">
            <input type="password" autoComplete="current-password" aria-label="Password" placeholder="Your password" className={inputCls} value={delPassword} onChange={e => setDelPassword(e.target.value)} />
            <input aria-label="Type your username to confirm" placeholder={`Type "${user?.username}" to confirm`} className={inputCls} value={confirm} onChange={e => setConfirm(e.target.value)} />
            {delError && <p className="text-xs text-red-400 font-mono">{delError}</p>}
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={() => { setShowDelete(false); setDelError(''); }}>CANCEL</Btn>
              <Btn variant="danger" onClick={deleteAccount} disabled={busy || !delPassword || confirm !== user?.username}>PERMANENTLY DELETE</Btn>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
