import { type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import { createContext, useContext } from 'react';

export interface PatientSearchContextProps {
  /**
   * A function to execute instead of navigating the user to the patient
   * dashboard. If null/undefined, patient results will be links to the
   * patient dashboard.
   */
  nonNavigationSelectPatientAction?: (patientUuid: string) => void;
  /**
   * A function to execute when the user clicks on a patient result. Will
   * be executed whether or not nonNavigationSelectPatientAction is defined,
   * just before navigation (or after nonNavigationSelectPatientAction is called).
   */
  patientClickSideEffect?: ((patientUuid: string) => void) | (() => void);
  /**
   * Whether the embedded search should render the registered primary patient
   * actions. Embedded selectors hide these actions unless the consuming flow
   * explicitly opts in.
   */
  showPrimaryActions?: boolean;
}

export const PatientSearchContext = createContext<PatientSearchContextProps>({});

export interface PatientSearchContext2Props {
  onPatientSelected?(
    patientUuid: string,
    patient: fhir.Patient,
    launchChildWorkspace: Workspace2DefinitionProps['launchChildWorkspace'],
    closeWorkspace: Workspace2DefinitionProps['closeWorkspace'],
  ): void;
  launchChildWorkspace: Workspace2DefinitionProps['launchChildWorkspace'];
  closeWorkspace: Workspace2DefinitionProps['closeWorkspace'];
  startVisitWorkspaceName?: string;
  startVisitWorkspaceProps?: object;
}

export const PatientSearchContext2 = createContext<PatientSearchContext2Props>(null);
export const usePatientSearchContext2 = () => useContext(PatientSearchContext2);
