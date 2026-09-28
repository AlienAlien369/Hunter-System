import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { disableReminders, enableReminders, notify, remindersEnabled, remindersSupported } from '../utils/reminders';
import { Btn } from './hunter/ui';

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Captured globally: browsers fire this once, possibly before Settings mounts.
let deferredPrompt: InstallPrompt | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e as InstallPrompt;
  });
}

const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);

/** Settings → App: install Hunter to the home screen, and timetable reminders. */
export default function AppSettingsPanel() {
  const [reminders, setReminders] = useState(remindersEnabled());
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);
  const [installed, setInstalled] = useState(isStandalone());
  const [note, setNote] = useState('');

  useEffect(() => {
    const onPrompt = () => setCanInstall(true);
    const onInstalled = () => { setInstalled(true); setCanInstall(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setCanInstall(false);
    if (outcome === 'accepted') setInstalled(true);
  };

  const toggleReminders = async () => {
    setNote('');
    if (reminders) {
      disableReminders();
      setReminders(false);
      return;
    }
    const ok = await enableReminders();
    setReminders(ok);
    if (ok) notify('✅ Reminders on', "You'll be reminded when each timetable quest starts.", '/time').catch(() => {});
    else setNote('Notifications are blocked for this site — allow them in your browser settings to turn reminders on.');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="bg-[#0d1117]/80 backdrop-blur-xl rounded-xl border border-accent-border p-5 space-y-4"
    >
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg accent-gradient flex items-center justify-center text-sm">📱</div>
        <div>
          <h2 className="text-white font-display font-bold tracking-wider">APP & REMINDERS</h2>
          <p className="text-xs text-gray-500 font-mono">Install Hunter and get nudged when a timetable quest starts</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#161b22]/80 border border-purple-500/15 p-3">
        <div className="min-w-0">
          <p className="text-sm text-white font-mono">Install on this device</p>
          <p className="text-[11px] text-gray-500 font-mono">
            {installed ? 'Installed — Hunter opens like a native app.'
              : canInstall ? 'Add Hunter to your home screen for one-tap access.'
                : 'On iPhone: Share → Add to Home Screen. On Android/desktop Chrome: the install icon in the address bar.'}
          </p>
        </div>
        {!installed && canInstall && <Btn onClick={install}>INSTALL APP</Btn>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#161b22]/80 border border-purple-500/15 p-3">
        <div className="min-w-0">
          <p className="text-sm text-white font-mono">Timetable reminders</p>
          <p className="text-[11px] text-gray-500 font-mono">
            {remindersSupported() ? 'A notification when each of today\'s timetable quests is due (while Hunter is open or installed).' : 'This browser does not support notifications.'}
          </p>
        </div>
        {remindersSupported() && (
          <Btn variant={reminders ? 'ghost' : 'primary'} onClick={toggleReminders} aria-pressed={reminders}>
            {reminders ? 'TURN OFF' : 'TURN ON'}
          </Btn>
        )}
      </div>
      {note && <p className="text-xs text-yellow-300/90 font-mono">{note}</p>}
    </motion.div>
  );
}
