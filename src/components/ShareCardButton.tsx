import { useState } from 'react';
import { api } from '../lib/api';
import { useGameStore } from '../store/gameStore';
import { useModuleStore } from '../store/moduleStore';
import { calculateRank } from '../utils/xp';
import { drawHunterCard, shareHunterCard, type CardData } from '../utils/shareCard';
import { Btn, Modal } from './hunter/ui';
import { useT } from '../i18n';
import { trackEvent } from '../lib/track';

/** "Share my Hunter card": render a status image and send it through the native share sheet. */
export default function ShareCardButton() {
  const t = useT();
  const [preview, setPreview] = useState<{ url: string; blob: Blob; data: CardData } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const open = async () => {
    setBusy(true);
    setNote('');
    try {
      const { profile, stats } = useGameStore.getState();
      const me = await api.getLeaderboard('week').then(l => l.me).catch(() => null);
      // Public hunters link to their profile page (with a "race me" button); others to the app.
      const data: CardData = {
        name: profile.name,
        rank: calculateRank(profile.xp),
        level: profile.level,
        xp: profile.xp,
        streak: stats?.streak ?? 0,
        weeklyXp: me?.score ?? 0,
        modules: useModuleStore.getState().modules.filter(m => m.status === 'active').map(m => `${m.icon} ${m.name}`),
        url: me?.nameSet && me.visible ? `${window.location.origin}/h/${encodeURIComponent(profile.name)}` : window.location.origin,
      };
      const blob = await drawHunterCard(data);
      setPreview({ url: URL.createObjectURL(blob), blob, data });
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const share = async () => {
    trackEvent('share_click');
    if (!preview) return;
    const r = await shareHunterCard(preview.blob, preview.data);
    setNote(r === 'downloaded' ? t('share.saved') : r === 'shared' ? t('share.shared') : '');
  };

  return (
    <>
      <button type="button" onClick={open} disabled={busy}
        className="px-3 py-2 rounded-lg border border-purple-500/30 text-purple-200 hover:bg-purple-500/10 font-display text-xs tracking-[0.2em] disabled:opacity-50">
        {busy ? '…' : t('share.button')}
      </button>
      <Modal open={!!preview} onClose={close} title={t('share.title')}>
        {preview && (
          <div className="space-y-4">
            <img src={preview.url} alt={t('share.alt', { name: preview.data.name })} className="w-full rounded-xl border border-purple-500/30" />
            {note && <p className="text-sm text-purple-200 font-mono">{note}</p>}
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={close}>{t('share.close')}</Btn>
              <Btn onClick={share}>{t('share.share')}</Btn>
            </div>
          </div>
        )}
      </Modal>
      {!preview && note && <span className="text-xs text-red-400 font-mono">{note}</span>}
    </>
  );
}
