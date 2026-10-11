import { useModuleStore } from '../../store/moduleStore';
import { useT } from '../../i18n';
import { RoutineChangeDialog } from '../routine/RoutineEditor';

/** App-wide dialog for any module/task change that carries XP consequences. */
export default function XpConfirmHost() {
  const t = useT();
  const pending = useModuleStore(s => s.pending);
  const answer = useModuleStore(s => s.answer);
  return (
    <RoutineChangeDialog
      preview={pending}
      busy={false}
      error=""
      title={t('rc.commitTitle')}
      intro={t('rc.commitIntro')}
      onCancel={() => answer(false)}
      onConfirm={() => answer(true)}
    />
  );
}
