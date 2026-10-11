import { en, type MessageKey } from '../../i18n/messages/en';

// The server explains each XP change in English. These are its fixed reasons, mapped to translations;
// anything not listed (or a future reason) is shown as the server wrote it.
const REASONS: Record<string, MessageKey> = {
  'An established module was replaced': 'rr.moduleReplaced',
  'An established module was removed': 'rr.moduleRemoved',
  'Setup period — no XP impact': 'rr.setup',
  'Module was added less than 48 hours ago — no XP impact': 'rr.module48',
  'Expanding your routine': 'rr.expanding',
  'Module reward already claimed once': 'rr.rewardClaimed',
  'An established commitment was removed': 'rr.commitRemoved',
  'Commitment is less than 48 hours old — no XP impact': 'rr.commit48',
  'New commitment': 'rr.newCommit',
  'Task is less than 48 hours old — no XP impact': 'rr.task48',
  'Major change to an established commitment': 'rr.major',
  'Minor adjustment': 'rr.minor',
  'Removed within 48 hours — the module reward is returned': 'rr.refund',
  'Pausing an established module is a major change': 'rr.pause',
};

export function reasonText(t: (key: MessageKey) => string, reason: string): string {
  const key = REASONS[reason];
  return key && key in en ? t(key) : reason;
}
