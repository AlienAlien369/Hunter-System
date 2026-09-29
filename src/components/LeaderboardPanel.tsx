import { useEffect, useState } from 'react';
import { api, type Leaderboard } from '../lib/api';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { Btn, Panel, inputCls } from './hunter/ui';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Hunter leaderboard: this week's earned XP (resets Monday UTC) or all-time XP. */
export default function LeaderboardPanel() {
  const [period, setPeriod] = useState<'week' | 'all' | 'friends'>('week');
  const [data, setData] = useState<Leaderboard | null>(null);
  const [error, setError] = useState('');
  const xp = useGameStore(s => s.profile.xp);

  useEffect(() => {
    if (period === 'friends') return;
    api.getLeaderboard(period).then(d => { setData(d); setError(''); }).catch(e => setError((e as Error).message));
  }, [period, xp]);

  const toggleVisible = async () => {
    if (!data || period === 'friends') return;
    await api.setLeaderboardVisibility(!data.me.visible);
    setData(await api.getLeaderboard(period));
  };

  const tab = (p: 'week' | 'all' | 'friends', label: string) => (
    <button type="button" onClick={() => setPeriod(p)} aria-pressed={period === p}
      className={`px-2.5 py-1 rounded-md text-[11px] font-mono border ${period === p ? 'bg-purple-500/20 border-purple-400/50 text-purple-100' : 'border-gray-700 text-gray-500 hover:text-gray-300'}`}>
      {label}
    </button>
  );

  const unit = period === 'week' ? 'XP this week' : 'XP';
  return (
    <Panel title="🏆 HUNTER LEADERBOARD" right={<div className="flex gap-1.5">{tab('week', 'THIS WEEK')}{tab('all', 'ALL TIME')}{tab('friends', 'FRIENDS')}</div>}>
      {error && <p className="text-sm text-red-400 font-mono">{error}</p>}
      {period === 'friends' && <FriendsBoard xp={xp} />}
      {period !== 'friends' && data && (
        <div className="space-y-3">
          {data.entries.length === 0 ? (
            <p className="text-sm text-gray-500 font-mono">No hunters on the board yet{period === 'week' ? ' this week' : ''}. Complete a quest to claim the top spot.</p>
          ) : (
            <ol className="space-y-1.5">
              {data.entries.map(e => (
                <li key={`${e.position}-${e.name}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${e.isMe ? 'border-purple-400/60 bg-purple-500/15' : 'border-purple-500/10 bg-[#161b22]/60'}`}>
                  <span className="w-8 text-center font-display text-sm text-gray-400">{MEDALS[e.position - 1] ?? `#${e.position}`}</span>
                  <span className="flex-1 min-w-0 truncate font-mono text-sm text-white">{e.name}{e.isMe && <span className="text-purple-300"> (you)</span>}</span>
                  <span className="text-[11px] font-mono text-gray-500 hidden sm:inline">Lv {e.level} · {e.rank}-Rank</span>
                  <span className="font-display text-gold text-sm w-24 text-right">{e.score.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-gray-400 border-t border-purple-500/10 pt-3">
            <span>
              You: <span className="text-white">{data.me.score.toLocaleString()} {unit}</span>
              {data.me.position ? <> · <span className="text-purple-300">#{data.me.position}</span></> : null}
              {!data.me.nameSet && ' · choose a Hunter name to appear on the board'}
              {period === 'week' && <span className="text-gray-600"> · resets Monday 00:00 UTC</span>}
            </span>
            {data.me.nameSet && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={data.me.visible} onChange={toggleVisible} />
                Show me on the leaderboard
              </label>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}

type Friends = Awaited<ReturnType<typeof api.getFriends>>['friends'];

/** Friends tab: you + hunters you follow, ranked by this week's XP. */
function FriendsBoard({ xp }: { xp: number }) {
  const [friends, setFriends] = useState<Friends | null>(null);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = () => api.getFriends().then(r => setFriends(r.friends)).catch(e => setMsg({ ok: false, text: (e as Error).message }));
  useEffect(() => { load(); }, [xp]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await api.addFriend(name);
      setName('');
      setMsg({ ok: true, text: `Now following ${r.name}.` });
      load();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  };
  const remove = async (n: string) => {
    await api.removeFriend(n).catch(() => {});
    load();
  };
  const me = useAuthStore(s => s.user);
  const invite = async () => {
    const url = `${window.location.origin}/login?invite=${encodeURIComponent(me?.name ?? '')}`;
    const text = `Race me on Hunter System — daily quests, XP and ranks for real life.`;
    try {
      if (navigator.share) await navigator.share({ title: 'Hunter System', text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); setMsg({ ok: true, text: 'Invite link copied.' }); }
    } catch { /* share sheet dismissed */ }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="flex gap-2">
        <input aria-label="Hunter name" className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Add a friend by their Hunter name" maxLength={30} />
        <Btn type="submit" disabled={!name.trim()}>FOLLOW</Btn>
      </form>
      {me?.name_set ? (
        <Btn type="button" onClick={invite}>🔗 INVITE A FRIEND</Btn>
      ) : (
        <p className="text-[11px] text-gray-500 font-mono">Choose a Hunter name to get your invite link.</p>
      )}
      {msg && <p className={`text-xs font-mono ${msg.ok ? 'text-green-400' : 'text-yellow-300'}`}>{msg.text}</p>}
      {friends && friends.length <= 1 && (
        <p className="text-sm text-gray-500 font-mono">Follow friends to race them on weekly XP. Invite a friend — you'll follow each other automatically.</p>
      )}
      {friends && (
        <ol className="space-y-1.5">
          {friends.map(f => (
            <li key={f.name} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${f.isMe ? 'border-purple-400/60 bg-purple-500/15' : 'border-purple-500/10 bg-[#161b22]/60'}`}>
              <span className="w-8 text-center font-display text-sm text-gray-400">{MEDALS[f.position - 1] ?? `#${f.position}`}</span>
              <span className="flex-1 min-w-0">
                <span className="block truncate font-mono text-sm text-white">{f.name}{f.isMe && <span className="text-purple-300"> (you)</span>}</span>
                <span className="block text-[10px] font-mono text-gray-500">Lv {f.level} · {f.rank}-Rank{f.lastActive ? ` · active ${f.lastActive}` : ''}</span>
              </span>
              <span className="font-display text-gold text-sm w-24 text-right">{f.weeklyXp.toLocaleString()}</span>
              {!f.isMe && (
                <button type="button" onClick={() => remove(f.name)} aria-label={`Unfollow ${f.name}`} className="text-gray-600 hover:text-red-400 text-sm">✕</button>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="text-[11px] text-gray-600 font-mono">XP this week · resets Monday 00:00 UTC</p>
    </div>
  );
}
