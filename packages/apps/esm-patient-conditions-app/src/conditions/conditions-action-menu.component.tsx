import { Layer, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { showModal, useLayoutType, userHasAccess, useSession } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type Condition } from './conditions.resource';
import styles from './conditions-action-menu.scss';

interface conditionsActionMenuProps {
  condition: Condition;
  patientUuid?: string;
}

export const ConditionsActionMenu = ({ condition, patientUuid }: conditionsActionMenuProps) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const session = useSession();
  const canEdit = userHasAccess('app:hoja.clinica.condiciones.editar', session?.user);

  const launchEditConditionsForm = useCallback(
    () =>
      launchPatientWorkspace('conditions-form-workspace', {
        workspaceTitle: t('editAntecedent', 'Edit antecedent'),
        condition,
        formContext: 'editing',
      }),
    [condition, t],
  );

  if (!canEdit) {
    return null;
  }

  const launchDeleteConditionDialog = (conditionId: string) => {
    const dispose = showModal('patient-conditions-delete-confirmation-dialog', {
      closeDeleteModal: () => dispose(),
      conditionId,
      patientUuid,
    });
  };

  return (
    <Layer className={styles.layer}>
      <OverflowMenu
        aria-label={t('editOrDeleteAntecedent', 'Edit or delete antecedent')}
        align="left"
        size={isTablet ? 'lg' : 'sm'}
        flipped
      >
        <OverflowMenuItem
          className={styles.menuItem}
          id="editCondition"
          onClick={launchEditConditionsForm}
          itemText={t('edit', 'Edit')}
        />
        <OverflowMenuItem
          className={styles.menuItem}
          id="deleteCondition"
          itemText={t('delete', 'Delete')}
          onClick={() => launchDeleteConditionDialog(condition.id)}
          isDelete
          hasDivider
        />
      </OverflowMenu>
    </Layer>
  );
};
