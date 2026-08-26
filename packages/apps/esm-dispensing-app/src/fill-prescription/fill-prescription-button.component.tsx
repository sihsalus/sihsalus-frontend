import { Button } from '@carbon/react';
import {
  AddIcon,
  type FetchResponse,
  launchWorkspace2,
  type Order,
  openmrsFetch,
  restBaseUrl,
  showModal,
  showSnackbar,
  useLayoutType,
  userHasAccess,
  useSession,
  type Visit,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { dispensingEditPrivilege, PRIVILEGE_ADD_ORDERS, PRIVILEGE_CREATE_DISPENSE } from '../constants';
import styles from './fill-prescription-button.scss';

const FillPrescriptionButton: React.FC<{}> = () => {
  const isTablet = useLayoutType() === 'tablet';
  const responsiveSize = isTablet ? 'lg' : 'md';
  const { t } = useTranslation();
  const session = useSession();
  const canRegisterManualPrescription = Boolean(
    session?.user &&
      userHasAccess(dispensingEditPrivilege, session.user) &&
      userHasAccess(PRIVILEGE_CREATE_DISPENSE, session.user) &&
      userHasAccess(PRIVILEGE_ADD_ORDERS, session.user),
  );

  const launchSearchWorkspace = () => {
    launchWorkspace2(
      'dispensing-patient-search-workspace',
      {
        workspaceTitle: t('fillPrescriptionForPatient', 'Register a manual prescription'),
        onPatientSelected(
          patientUuid: string,
          patient: fhir.Patient,
          _launchChildWorkspace: Workspace2DefinitionProps['launchChildWorkspace'],
          closeWorkspace: Workspace2DefinitionProps['closeWorkspace'],
        ) {
          getActiveVisitsForPatient(patientUuid).then(async (response) => {
            const activeVisit = response.data.results?.[0];
            if (activeVisit) {
              await closeWorkspace();
              launchWorkspace2(
                'dispensing-order-basket-workspace',
                {},
                {
                  patientUuid: patientUuid,
                  patient: patient,
                  visitContext: activeVisit,
                  drugOrderWorkspaceName: 'dispensing-order-basket-add-drug-order-workspace',
                  allergyFormWorkspaceName: 'dispensing-order-basket-add-allergy-workspace',
                  onOrderBasketSubmitted: (encounterUuid: string, _: Array<Order>) => {
                    showModal('on-prescription-filled-modal', {
                      patient,
                      encounterUuid,
                    });
                  },
                },
              );
            } else {
              showSnackbar({
                title: t('visitRequired', 'Visit required'),
                subtitle: t(
                  'visitRequiredForPatientToFillPrescription',
                  'An active visit is required to register a manual prescription.',
                ),
                kind: 'error',
              });
            }
          });
        },
      },
      {
        startVisitWorkspaceName: 'dispensing-start-visit-workspace',
      },
    );
  };

  if (!canRegisterManualPrescription) {
    return null;
  }

  return (
    <div className={styles.buttonContainer}>
      <Button
        kind="tertiary"
        renderIcon={(props) => <AddIcon size={16} {...props} />}
        size={responsiveSize}
        onClick={launchSearchWorkspace}
      >
        {t('fillPrescription', 'Register prescription manually')}
      </Button>
    </div>
  );
};

function getActiveVisitsForPatient(
  patientUuid: string,
  abortController?: AbortController,
  v?: string,
): Promise<FetchResponse<{ results: Array<Visit> }>> {
  const custom = v ?? `default`;

  return openmrsFetch(`${restBaseUrl}/visit?patient=${patientUuid}&v=${custom}&includeInactive=false`, {
    signal: abortController?.signal,
    method: 'GET',
    headers: {
      'Content-type': 'application/json',
    },
  });
}

export default FillPrescriptionButton;
