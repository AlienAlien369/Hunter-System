import { useModuleStore } from '../../store/moduleStore';
import { RoutineChangeDialog } from '../routine/RoutineEditor';

/** App-wide dialog for any module/task change that carries XP consequences. */
export default function XpConfirmHost() {
  const pending = useModuleStore(s => s.pending);
  const answer = useModuleStore(s => s.answer);
  return (
    <RoutineChangeDialog
      preview={pending}
      busy={false}
      error=""
      title="⚠️ HUNTER COMMITMENT CHANGE"
      intro="You are changing an established module commitment."
      onCancel={() => answer(false)}
      onConfirm={() => answer(true)}
    />
  );
}
