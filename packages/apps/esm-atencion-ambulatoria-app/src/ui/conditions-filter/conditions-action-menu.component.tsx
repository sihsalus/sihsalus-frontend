import { Layer, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { launchWorkspace, showModal, useLayoutType } from '@openmrs/esm-framework';
import { isSupportedConditionStatus } from '@openmrs/esm-patient-common-lib';
import { useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { type Condition } from './conditions.resource';
import styles from './conditions-action-menu.scss';

interface conditionsActionMenuProps {
  condition: Condition;
  patientUuid: string;
}

export const ConditionsActionMenu = ({ condition, patientUuid }: conditionsActionMenuProps) => {
  const { t } = useTranslation();
  const actionId = useId();
  const canEditStatus = isSupportedConditionStatus(condition?.clinicalStatus);
  const isTablet = useLayoutType() === 'tablet';

  const launchEditConditionsForm = useCallback(() => {
    if (!canEditStatus) return;
    launchWorkspace('conditions-filter-form-workspace', {
      workspaceTitle: t('editAntecedent', 'Edit antecedent'),
      condition,
      formContext: 'editing',
    });
  }, [canEditStatus, condition, t]);

  const launchDeleteConditionDialog = (conditionId: string) => {
    const dispose = showModal('ambulatoria-condition-delete-confirmation-dialog', {
      closeDeleteModal: () => dispose(),
      conditionId,
      patientUuid,
    });
  };

  if (!condition) return null;

  return (
    <Layer className={styles.layer}>
      <OverflowMenu
        aria-label={t('editOrDeleteAntecedent', 'Edit or delete antecedent')}
        size={isTablet ? 'lg' : 'sm'}
        flipped
        align="left"
      >
        <OverflowMenuItem
          className={styles.menuItem}
          id={`${actionId}-edit`}
          disabled={!canEditStatus}
          onClick={launchEditConditionsForm}
          itemText={t('edit', 'Edit')}
        />
        <OverflowMenuItem
          className={styles.menuItem}
          id={`${actionId}-delete`}
          itemText={t('delete', 'Delete')}
          onClick={() => launchDeleteConditionDialog(condition.id)}
          isDelete
          hasDivider
        />
      </OverflowMenu>
    </Layer>
  );
};
