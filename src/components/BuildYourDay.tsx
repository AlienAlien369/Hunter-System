import { openRoutineSetup } from '../utils/dailyBoard';

/** Empty daily board: invite the hunter to turn their day into quests. */
export default function BuildYourDay({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-xl border border-dashed border-purple-500/40 bg-purple-500/5 text-center ${compact ? 'p-5' : 'p-8'}`}>
      <p className="text-3xl mb-2">🗓️</p>
      <p className="font-display text-white tracking-wider">BUILD YOUR DAY</p>
      <p className="text-sm text-gray-400 font-mono mt-2 max-w-md mx-auto">
        Your daily quests come from your own timetable. Describe your day — Hunter turns it into quests with XP, or build it slot by slot.
      </p>
      <button
        type="button"
        onClick={openRoutineSetup}
        className="mt-4 px-4 py-2 rounded-lg border border-purple-400/50 bg-purple-600/30 hover:bg-purple-600/50 text-purple-100 font-display text-xs tracking-[0.2em]"
      >
        CREATE MY TIMETABLE
      </button>
    </div>
  );
}
