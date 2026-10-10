import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import BackgroundFX from '../components/BackgroundFX';
import { LEGAL_DOCS, type LegalKind } from '../data/legal';
import { LEGAL, legalConfigured } from '../data/legalConfig';

const LINKS: { kind: LegalKind; to: string; label: string }[] = [
  { kind: 'terms', to: '/terms', label: 'Terms' },
  { kind: 'privacy', to: '/privacy', label: 'Privacy' },
  { kind: 'refund', to: '/refund', label: 'Refunds' },
];

/** Public legal pages (/terms, /privacy, /refund) — readable without an account. */
export default function Legal({ kind }: { kind: LegalKind }) {
  const doc = LEGAL_DOCS[kind];
  useEffect(() => {
    document.title = `${doc.title} · Hunter System`;
    window.scrollTo(0, 0);
  }, [doc.title]);

  return (
    <main className="min-h-screen px-4 py-10" style={{ background: 'var(--bg-base)' }}>
      <BackgroundFX />
      <div className="relative max-w-3xl mx-auto">
        <nav className="flex flex-wrap items-center gap-4 text-xs font-mono mb-6" aria-label="Legal pages">
          <Link to="/login" className="text-purple-300 hover:text-white">← Hunter System</Link>
          {LINKS.map(l => (
            <Link key={l.kind} to={l.to} className={l.kind === kind ? 'text-white underline' : 'text-gray-400 hover:text-white'}>{l.label}</Link>
          ))}
        </nav>
        <article className="bg-[#0d1117]/90 backdrop-blur-xl rounded-xl border border-purple-500/30 p-6 sm:p-8">
          <h1 className="font-display text-2xl sm:text-3xl text-white font-bold tracking-wider">{doc.title}</h1>
          <p className="text-[11px] font-mono text-gray-500 mt-1">Version {LEGAL.version} · effective {LEGAL.effective}</p>
          {!legalConfigured && (
            <p role="note" className="mt-4 text-xs font-mono text-yellow-300 border border-yellow-500/30 bg-yellow-500/10 rounded-lg px-3 py-2">
              The operator’s name, address and contact details have not been filled in yet. They must be added before this service is launched to the public.
            </p>
          )}
          <p className="text-sm text-gray-300 mt-5 leading-relaxed">{doc.intro}</p>
          {doc.sections.map(s => (
            <section key={s.heading} className="mt-7">
              <h2 className="font-display text-white tracking-wider text-sm sm:text-base">{s.heading}</h2>
              {s.paragraphs?.map(p => <p key={p} className="text-sm text-gray-300 mt-2 leading-relaxed">{p}</p>)}
              {s.bullets && (
                <ul className="mt-2 space-y-2 list-disc pl-5 marker:text-purple-400">
                  {s.bullets.map(b => <li key={b} className="text-sm text-gray-300 leading-relaxed">{b}</li>)}
                </ul>
              )}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
