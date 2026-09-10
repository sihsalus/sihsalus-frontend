import { Layer, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { launchWorkspace2, showModal, useLayoutType, userHasAccess, useSession } from '@openmrs/esm-framework';
import { isSupportedConditionStatus } from '@openmrs/esm-patient-common-lib';
import { useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { credAntecedentsEditPrivilege } from '../../constants';
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
  const session = useSession();
  const canEdit = userHasAccess(credAntecedentsEditPrivilege, session?.user);

  const launchEditConditionsForm = useCallback(() => {
    if (!canEditStatus) return;
    launchWorkspace2('maternal-conditions-form-workspace', {
      workspaceTitle: t('editCondition', 'Edit a Condition'),
      condition,
      formContext: 'editing',
      patientUuid,
    });
  }, [canEditStatus, condition, patientUuid, t]);

  const launchDeleteConditionDialog = (conditionId: string) => {
    const dispose = showModal('cred-condition-delete-confirmation-dialog', {
      closeDeleteModal: () => dispose(),
      conditionId,
      patientUuid,
    });
  };

  if (!condition || !canEdit) {
    return null;
  }

  return (
    <Layer className={styles.layer}>
      <OverflowMenu aria-label="Edit or delete condition" size={isTablet ? 'lg' : 'sm'} flipped align="left">
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
