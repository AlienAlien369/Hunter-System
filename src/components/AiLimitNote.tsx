import { Link } from 'react-router-dom';
import { useT } from '../i18n';
import { trackEvent } from '../lib/track';

/**
 * Shown when the daily AI allowance is gone. Honest and small: it says the manual route still works,
 * that the allowance resets tomorrow, and links to Pro without pushing. No countdowns, no guilt.
 */
export default function AiLimitNote() {
  const t = useT();
  return (
    <p className="text-sm text-yellow-300/90 font-mono">
      {t('ai.limit')}{' '}
      <Link to="/pricing" onClick={() => trackEvent('upgrade_click', { page: '/ai-limit' })} className="underline text-purple-200 hover:text-white">{t('ai.seePro')}</Link>
    </p>
  );
}
