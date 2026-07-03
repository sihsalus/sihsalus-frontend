import { Grid, Row } from '@carbon/react';
import { ExtensionSlot, useConnectivity, useSession } from '@openmrs/esm-framework';
import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import classNames from 'classnames';
import { useMemo } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import useSWRImmutable from 'swr/immutable';
import BulkPatientImport from './bulk-patient-import/bulk-patient-import.component';
import {
  fetchAddressTemplate,
  fetchAllRelationshipTypes,
  fetchPatientIdentifierTypesWithSources,
  type RelationshipTypesResponse,
  ResourcesContext,
} from './offline.resources';
import { FormManager } from './patient-registration/form-manager';
import { PatientRegistration } from './patient-registration/patient-registration.component';
import styles from './root.scss';

const registerPatientPrivilege = 'app:topnav.registerPatient';

export default function Root() {
  const isOnline = useConnectivity();
  const currentSession = useSession();
  const {
    data: addressTemplate,
    error: addressTemplateError,
    isLoading: isLoadingAddressTemplate,
  } = useSWRImmutable('patientRegistrationAddressTemplate', fetchAddressTemplate);
  const {
    data: relationshipTypes,
    error: relationshipTypesError,
    isLoading: isLoadingRelationshipTypes,
  } = useSWRImmutable<RelationshipTypesResponse>('patientRegistrationRelationshipTypes', fetchAllRelationshipTypes);
  const {
    data: identifierTypes,
    error: identifierTypesError,
    isLoading: isLoadingIdentifierTypes,
  } = useSWRImmutable('patientRegistrationPatientIdentifiers', fetchPatientIdentifierTypesWithSources);
  const savePatientForm = useMemo(
    () => (isOnline ? FormManager.savePatientFormOnline : FormManager.savePatientFormOffline),
    [isOnline],
  );

  return (
    <AppErrorBoundary appName="esm-patient-registration-app">
      <RequirePrivilege
        privilege={registerPatientPrivilege}
        description="Necesita permisos para acceder al flujo de registro de pacientes."
      >
        <main className={classNames('omrs-main-content', styles.root)}>
          <Grid className={styles.grid}>
            <Row>
              <ExtensionSlot name="breadcrumbs-slot" />
            </Row>
            <ResourcesContext.Provider
              value={{
                addressTemplate,
                addressTemplateError,
                isLoadingAddressTemplate,
                relationshipTypes,
                relationshipTypesError,
                isLoadingRelationshipTypes,
                identifierTypes: identifierTypes ?? [],
                identifierTypesError,
                isLoadingIdentifierTypes,
                currentSession,
              }}
            >
              <BrowserRouter basename={globalThis.getOpenmrsSpaBase()}>
                <Routes>
                  <Route
                    path="patient-registration"
                    element={<PatientRegistration savePatientForm={savePatientForm} isOffline={!isOnline} />}
                  />
                  <Route
                    path="patient/:patientUuid/edit"
                    element={<PatientRegistration savePatientForm={savePatientForm} isOffline={!isOnline} />}
                  />
                  <Route path="patient-import" element={<BulkPatientImport isOffline={!isOnline} />} />
                </Routes>
              </BrowserRouter>
            </ResourcesContext.Provider>
          </Grid>
        </main>
      </RequirePrivilege>
    </AppErrorBoundary>
  );
}
