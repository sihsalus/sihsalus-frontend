import { ExtensionSlot, launchWorkspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import React from 'react';

import styles from './patient-search.scss';

const PatientSearch: React.FC<Partial<Workspace2DefinitionProps<object, object>>> = ({ launchChildWorkspace }) => {
  const launchCreateAppointmentForm = (patient) => {
    const props = {
      patientUuid: patient.uuid,
      context: 'creating',
      mutate: () => {}, // TODO get this to mutate properly
    };

    if (launchChildWorkspace) {
      launchChildWorkspace('appointments-form-workspace', { ...props });
      return;
    }

    launchWorkspace2('appointments-form-workspace', { ...props });
  };

  return (
    <div className="omrs-main-content">
      <span className={styles.searchBarWrapper}>
        <ExtensionSlot
          name="patient-search-bar-slot"
          state={{
            selectPatientAction: launchCreateAppointmentForm,
            buttonProps: {
              kind: 'primary',
            },
          }}
        />
      </span>
    </div>
  );
};

export default PatientSearch;
