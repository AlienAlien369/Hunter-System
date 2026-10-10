import { Link } from 'react-router-dom';
import { useT } from '../i18n';
import type { MessageKey } from '../i18n/messages/en';

const LINKS: { kind: string; to: string; label: MessageKey }[] = [
  { kind: 'pricing', to: '/pricing', label: 'legal.pricing' },
  { kind: 'terms', to: '/terms', label: 'legal.terms' },
  { kind: 'privacy', to: '/privacy', label: 'legal.privacy' },
  { kind: 'refund', to: '/refund', label: 'legal.refunds' },
];

/** Small footer used on the login page and in Settings. */
export default function LegalLinks({ className = '' }: { className?: string }) {
  const t = useT();
  return (
    <p className={`text-[11px] font-mono text-gray-500 ${className}`}>
      {LINKS.map((l, i) => (
        <span key={l.kind}>
          {i > 0 && ' · '}
          <Link to={l.to} className="hover:text-white underline-offset-2 hover:underline">{t(l.label)}</Link>
        </span>
      ))}
    </p>
  );
}
