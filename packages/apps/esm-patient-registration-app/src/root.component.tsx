import { Grid, Row } from '@carbon/react';
import { ExtensionSlot, useConnectivity, useSession } from '@openmrs/esm-framework';
import { AppErrorBoundary, RequirePrivilege } from '@sihsalus/esm-rbac';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import useSWRImmutable from 'swr/immutable';
import BulkPatientImport from './bulk-patient-import/bulk-patient-import.component';
import { moduleName } from './constants';
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

const registerPatientPrivilege = 'app:opciones.registrarPaciente';
const bulkPatientImportPrivilege = 'Manage Patients';

export default function Root() {
  const { t } = useTranslation(moduleName);
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
                  element={
                    <RequirePrivilege
                      privilege={registerPatientPrivilege}
                      description="Necesita permisos para acceder al flujo de registro de pacientes."
                    >
                      <PatientRegistration savePatientForm={savePatientForm} isOffline={!isOnline} />
                    </RequirePrivilege>
                  }
                />
                <Route
                  path="patient/:patientUuid/edit"
                  element={
                    <RequirePrivilege
                      privilege={registerPatientPrivilege}
                      description="Necesita permisos para acceder al flujo de registro de pacientes."
                    >
                      <PatientRegistration savePatientForm={savePatientForm} isOffline={!isOnline} />
                    </RequirePrivilege>
                  }
                />
                <Route
                  path="patient-import"
                  element={
                    <RequirePrivilege
                      privilege={bulkPatientImportPrivilege}
                      description={t(
                        'bulkPatientImportPrivilegeRequired',
                        'Patient administration permission is required to run a bulk import.',
                      )}
                    >
                      <BulkPatientImport isOffline={!isOnline} />
                    </RequirePrivilege>
                  }
                />
              </Routes>
            </BrowserRouter>
          </ResourcesContext.Provider>
        </Grid>
      </main>
    </AppErrorBoundary>
  );
}
