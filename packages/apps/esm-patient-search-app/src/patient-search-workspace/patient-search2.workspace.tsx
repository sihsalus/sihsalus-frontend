import { useConfig, useDebounce, Workspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { type PatientSearchConfig } from '../config-schema';
import { isPatientSearchTermValid } from '../patient-search-constants';
import PatientSearchBar from '../patient-search-bar/patient-search-bar.component';
import { PatientSearchContext2 } from '../patient-search-context';
import AdvancedPatientSearchComponent from '../patient-search-page/advanced-patient-search.component';

export interface PatientSearchWorkspaceProps {
  initialQuery?: string;
  workspaceTitle: string;
  onPatientSelected(
    patientUuid: string,
    patient: fhir.Patient,
    launchChildWorkspace: (workspaceName: string, workspaceProps?: object) => void,
    closeWorkspace: () => void,
  ): void;
}

export interface PatientSearchWorkspaceWindowProps {
  startVisitWorkspaceName?: string;
  startVisitWorkspaceProps?: object;
}

/**
 * This v2 workspace allows other apps to include patient search functionality.
 */
const PatientSearchWorkspace2: React.FC<
  Workspace2DefinitionProps<PatientSearchWorkspaceProps, PatientSearchWorkspaceWindowProps, {}>
> = ({ workspaceProps, windowProps, launchChildWorkspace, closeWorkspace }) => {
  const { initialQuery = '', onPatientSelected, workspaceTitle = 'Search patient' } = workspaceProps ?? {};
  const { startVisitWorkspaceName, startVisitWorkspaceProps } = windowProps ?? {};
  const {
    search: { disableTabletSearchOnKeyUp },
  } = useConfig<PatientSearchConfig>();
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const debouncedSearchTerm = useDebounce(searchTerm);
  const showSearchResults = isPatientSearchTermValid(debouncedSearchTerm);

  const handleClearSearchTerm = useCallback(() => setSearchTerm(''), []);

  return (
    <Workspace2 title={workspaceTitle}>
      <PatientSearchContext2.Provider
        value={{
          onPatientSelected,
          launchChildWorkspace,
          closeWorkspace,
          startVisitWorkspaceName,
          startVisitWorkspaceProps,
        }}
      >
        <PatientSearchBar
          initialSearchTerm={initialQuery}
          onChange={(value) => !disableTabletSearchOnKeyUp && setSearchTerm(value)}
          onClear={handleClearSearchTerm}
          onSubmit={setSearchTerm}
        />
        {showSearchResults && <AdvancedPatientSearchComponent query={debouncedSearchTerm} inTabletOrOverlay />}
      </PatientSearchContext2.Provider>
    </Workspace2>
  );
};

export default PatientSearchWorkspace2;
