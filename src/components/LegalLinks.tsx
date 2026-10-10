import { Link } from 'react-router-dom';

const LINKS = [
  { kind: 'terms', to: '/terms', label: 'Terms' },
  { kind: 'privacy', to: '/privacy', label: 'Privacy' },
  { kind: 'refund', to: '/refund', label: 'Refunds' },
];

/** Small footer used on the login page and in Settings. */
export default function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[11px] font-mono text-gray-500 ${className}`}>
      {LINKS.map((l, i) => (
        <span key={l.kind}>
          {i > 0 && ' · '}
          <Link to={l.to} className="hover:text-white underline-offset-2 hover:underline">{l.label}</Link>
        </span>
      ))}
    </p>
  );
}
