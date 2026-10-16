import { Layer, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { showModal, useLayoutType, userHasAccess, useSession } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './programs-action-menu.scss';

interface ProgramActionsProps {
  patientUuid: string;
  programEnrollmentId: string;
}

export const ProgramsActionMenu = ({ patientUuid, programEnrollmentId }: ProgramActionsProps) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const session = useSession();
  const canEdit = userHasAccess(['app:hoja.clinica.programas.editar', 'Edit Patient Programs'], session?.user);
  const canDelete = userHasAccess(['app:hoja.clinica.programas.editar', 'Delete Patient Programs'], session?.user);

  const launchEditProgramsForm = useCallback(
    () =>
      launchPatientWorkspace('programs-form-workspace', {
        workspaceTitle: t('editProgramEnrollment', 'Edit program enrollment'),
        programEnrollmentId,
      }),
    [programEnrollmentId, t],
  );

  const launchDeleteProgramDialog = useCallback(() => {
    const dispose = showModal('program-delete-confirmation-modal', {
      closeDeleteModal: () => dispose(),
      programEnrollmentId,
      patientUuid,
      size: 'sm',
    });
  }, [programEnrollmentId, patientUuid]);

  if (!canEdit && !canDelete) return null;

  return (
    <Layer className={styles.layer}>
      <OverflowMenu
        aria-label={t('editOrDeleteProgram', 'Edit or delete program')}
        align="left"
        flipped
        size={isTablet ? 'lg' : 'sm'}
      >
        {canEdit && (
          <OverflowMenuItem
            className={styles.menuItem}
            id="editProgram"
            itemText={t('edit', 'Edit')}
            onClick={launchEditProgramsForm}
          />
        )}
        {canDelete && (
          <OverflowMenuItem
            className={styles.menuItem}
            id="deleteProgam"
            hasDivider={canEdit}
            isDelete
            itemText={t('delete', 'Delete')}
            onClick={launchDeleteProgramDialog}
          />
        )}
      </OverflowMenu>
    </Layer>
  );
};
