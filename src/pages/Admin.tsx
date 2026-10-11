import { useEffect, useState } from 'react';
import { api, type BusinessReport, type FunnelReport } from '../lib/api';
import { Panel, Stat } from '../components/hunter/ui';
import { funnelSteps, fmtPct, visitToSignup } from '../utils/funnel';

const WINDOWS = [7, 30, 90];

/** Founder-only funnel view (/admin). Aggregates only — no individual hunters are ever shown. */
export default function Admin() {
  const [days, setDays] = useState(30);
  const [region, setRegion] = useState('');
  const [report, setReport] = useState<FunnelReport | null>(null);
  const [biz, setBiz] = useState<BusinessReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getFunnel(days, region || undefined)
      .then(r => { setReport(r); setError(''); })
      .catch(e => setError((e as Error).message));
  }, [days, region]);

  useEffect(() => { api.getBusiness(days).then(setBiz).catch(() => setBiz(null)); }, [days]);

  if (error) return <Panel title="ADMIN"><p className="text-sm text-yellow-300 font-mono" role="alert">{error}</p></Panel>;
  if (!report) return <p className="text-gray-400 font-mono text-sm">Loading funnel…</p>;

  const steps = funnelSteps(report.totals);
  const top = Math.max(1, report.totals.signups);
  const conv = visitToSignup(report);

  return (
    <div className="space-y-4 max-w-4xl">
      <Panel
        title="FUNNEL"
        right={
          <div className="flex items-center gap-2">
            <select aria-label="Region" value={region} onChange={e => setRegion(e.target.value)} className="bg-black/40 border border-purple-500/30 rounded px-2 py-1 text-xs font-mono text-gray-300">
              <option value="">All regions</option>
              {report.byRegion.map(r => <option key={r.region} value={r.region}>{r.region}</option>)}
              {region && !report.byRegion.some(r => r.region === region) && <option value={region}>{region}</option>}
            </select>
            {WINDOWS.map(d => (
              <button key={d} onClick={() => setDays(d)} className={`px-2 py-1 rounded text-xs font-mono border ${days === d ? 'border-purple-400 text-white bg-purple-600/30' : 'border-purple-500/20 text-gray-400'}`}>{d}d</button>
            ))}
          </div>
        }
      >
        <p className="text-[11px] text-gray-400 font-mono mb-4">
          Hunters who signed up in the last {report.days} days{report.region ? ` · region ${report.region}` : ''}. Derived from existing data — no extra tracking of individuals.
        </p>
        <ol className="space-y-3">
          {steps.map(s => (
            <li key={s.key}>
              <div className="flex justify-between text-sm font-mono">
                <span className="text-gray-200">{s.label}</span>
                <span className="text-white">{s.count.toLocaleString()} <span className="text-gray-400">{s.fromPrev === null ? '' : `· ${fmtPct(s.fromPrev)}`}</span></span>
              </div>
              <div className="h-2 mt-1 rounded bg-white/5 overflow-hidden" role="presentation">
                <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${Math.min(100, (s.count / top) * 100)}%` }} />
              </div>
              {s.note && <p className="text-[11px] text-gray-400 font-mono mt-1">{s.note}</p>}
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="VISITS (ANONYMOUS)">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="LANDING" value={report.visits.landing.toLocaleString()} />
          <Stat label="LOGIN PAGE" value={report.visits.login.toLocaleString()} />
          <Stat label="PRICING" value={report.visits.pricing.toLocaleString()} />
          <Stat label="UPGRADE CLICKS" value={report.visits.upgradeClicks.toLocaleString()} />
        </div>
        {!!report.visitsByLang?.length && (
          <table className="w-full text-xs font-mono mt-4">
            <thead><tr className="text-gray-400 text-left"><th className="py-1">LANGUAGE</th><th>LANDING</th><th>LOGIN</th><th>PRICING</th><th>UPGRADE CLICKS</th></tr></thead>
            <tbody>
              {report.visitsByLang.map(r => (
                <tr key={r.lang} className="border-t border-purple-500/10 text-gray-200">
                  <td className="py-1">{r.lang}</td><td>{r.landing}</td><td>{r.login}</td><td>{r.pricing}</td><td>{r.upgradeClicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-[11px] text-gray-400 font-mono mt-3">Visit → signup: {fmtPct(conv)}. Visitors who send Do Not Track or Global Privacy Control are not counted, so this reads high.</p>
      </Panel>

      {biz && (
        <Panel title="BUSINESS">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="ACTIVE SUBSCRIBERS" value={biz.subscriptions.active.toLocaleString()} />
            <Stat label="CANCELLING" value={biz.subscriptions.cancelling.toLocaleString()} />
            <Stat label="PAYMENT FAILING" value={biz.subscriptions.pastDue.toLocaleString()} />
            <Stat label="ENDED / REFUNDED" value={biz.subscriptions.refundedOrEnded.toLocaleString()} />
          </div>
          <p className="mt-4 text-xs font-mono text-gray-400">MRR (monthly equivalent, per currency, not converted):</p>
          <p className="text-sm font-mono text-white">
            {Object.keys(biz.subscriptions.mrrMinorByCurrency).length === 0
              ? '—'
              : Object.entries(biz.subscriptions.mrrMinorByCurrency).map(([c, v]) => `${c} ${(v / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`).join('  ·  ')}
          </p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label={`REFERRAL INVITES (${biz.days}D)`} value={biz.referrals.invites.toLocaleString()} />
            <Stat label="QUALIFIED" value={biz.referrals.qualified.toLocaleString()} />
            <Stat label="FREE MONTHS GRANTED" value={biz.referrals.rewardMonthsGranted.toLocaleString()} />
            <Stat label="ON FREE PRO NOW" value={biz.referrals.hunterOnReferralPro.toLocaleString()} />
            <Stat label="CLASSES" value={biz.classes.active.toLocaleString()} />
            <Stat label="CLASS STUDENTS" value={biz.classes.students.toLocaleString()} />
            <Stat label="AVG CLASS SIZE" value={String(biz.classes.avgSize)} />
            <Stat label="HIT AI LIMIT (7D)" value={biz.aiLimitHitters7d.toLocaleString()} />
          </div>
          <p className="mt-3 text-[11px] text-gray-400 font-mono">“Hit AI limit” counts free hunters who used all of a day’s AI suggestions: people who may want Pro. Aggregates only.</p>
        </Panel>
      )}

      <Panel title="BY REGION">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono text-left">
            <thead className="text-gray-400">
              <tr><th className="py-1">Region</th><th>Signups</th><th>Timetable</th><th>1st quest</th><th>Day 7</th><th>Upgraded</th></tr>
            </thead>
            <tbody className="text-gray-200">
              {report.byRegion.map(r => (
                <tr key={r.region} className="border-t border-white/5">
                  <td className="py-1">{r.region === '??' ? 'unknown' : r.region}</td>
                  <td>{r.signups}</td>
                  <td>{fmtPct(r.signups ? r.timetable / r.signups : null)}</td>
                  <td>{fmtPct(r.signups ? r.firstQuest / r.signups : null)}</td>
                  <td>{fmtPct(r.d7Eligible ? r.d7Returned / r.d7Eligible : null)}</td>
                  <td>{r.upgraded}</td>
                </tr>
              ))}
              {report.byRegion.length === 0 && <tr><td colSpan={6} className="py-3 text-gray-400">No signups in this window.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
