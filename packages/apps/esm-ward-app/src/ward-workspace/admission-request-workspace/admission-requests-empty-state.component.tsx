import { Button, Layer, Tile } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import {
  EmptyCardIllustration,
  useLayoutType,
  useSession,
  userHasAccess,
  useWorkspace2Context,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { wardEditPrivilege } from '../../constant';
import styles from './admission-requests-empty-state.scss';

const AdmissionRequestsEmptyState: React.FC = () => {
  const { t } = useTranslation();
  const isDesktop = useLayoutType() !== 'tablet';
  const session = useSession();
  const { launchChildWorkspace } = useWorkspace2Context();
  const canEdit = userHasAccess(wardEditPrivilege, session?.user);

  const handleAddPatient = () => {
    launchChildWorkspace('ward-app-patient-search-workspace', {
      workspaceTitle: t('addPatientToWard', 'Add patient to ward'),
      onPatientSelected(
        _patientUuid: string,
        patient: fhir.Patient,
        launchChildWorkspace: Workspace2DefinitionProps['launchChildWorkspace'],
        _closeWorkspace: Workspace2DefinitionProps['closeWorkspace'],
      ) {
        launchChildWorkspace('create-admission-encounter-workspace', {
          selectedPatientUuid: patient.id,
        });
      },
    });
  };

  return (
    <Layer>
      <Tile className={classNames(styles.emptyStateTile, { [styles.desktopTile]: isDesktop })}>
        <div className={styles.illustration}>
          <EmptyCardIllustration />
        </div>
        <p className={styles.content}>{t('noPendingAdmissionRequests', 'No pending admission requests')}</p>
        <p className={styles.helperText}>
          {t(
            'admissionRequestsEmptyHelperText',
            'Admission requests from other departments will appear here when patients are referred to this ward. You can also directly admit patients using the button below.',
          )}
        </p>
        {canEdit && (
          <div className={styles.action}>
            <Button renderIcon={Add} kind="ghost" onClick={handleAddPatient}>
              {t('addPatientToWard', 'Add patient to ward')}
            </Button>
          </div>
        )}
      </Tile>
    </Layer>
  );
};

export default AdmissionRequestsEmptyState;
