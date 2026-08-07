import { DataTableSkeleton } from '@carbon/react';
import {
  isDesktop,
  launchWorkspace2,
  useLayoutType,
  usePatient,
  userHasAccess,
  useSession,
  WorkspaceContainer,
} from '@openmrs/esm-framework';
import React, { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { appointmentsEditPrivilege } from '../constants';
import PatientAppointmentContext, { PatientAppointmentContextTypes } from '../hooks/patientAppointmentContext';

import PatientAppointmentsBase from './patient-appointments-base.component';
import PatientAppointmentsHeader from './patient-appointments-header';
import styles from './patient-appointments-overview.scss';

/**
 * This component renders the patient appointments view (all appointments for a single patient) outside of the context of the patient chart.
 * Currently, it is not linked directly within the Appointments app, but can be accessed via the home/appointments/patient/:patientUuid route,
 * providing a means for other apps (or legacy O2 UIs) to link to the patient appointments overview.
 * It uses the PatientAppointmentsBase component to render the actual appointments data.
 * @constructor
 */
const PatientAppointmentsOverview: React.FC = () => {
  const params = useParams();
  const response = usePatient(params.patientUuid);
  const layout = useLayoutType();
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const createRequestHandled = useRef(false);
  const createAppointmentRequested = searchParams.get('action') === 'create';
  const canCreateAppointment = userHasAccess(appointmentsEditPrivilege, session?.user);

  useEffect(() => {
    if (
      createRequestHandled.current ||
      !createAppointmentRequested ||
      !canCreateAppointment ||
      response.isLoading ||
      !response.patient?.id
    ) {
      return;
    }

    createRequestHandled.current = true;
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('action');
    setSearchParams(nextSearchParams, { replace: true });
    void launchWorkspace2('appointments-form-workspace', {
      context: 'creating',
      patientUuid: response.patient.id,
    });
  }, [
    canCreateAppointment,
    createAppointmentRequested,
    response.isLoading,
    response.patient?.id,
    searchParams,
    setSearchParams,
  ]);

  return response.isLoading ? (
    <DataTableSkeleton role="progressbar" size={isDesktop(layout) ? 'sm' : 'lg'} zebra />
  ) : (
    <PatientAppointmentContext.Provider value={PatientAppointmentContextTypes.APPOINTMENTS_APP}>
      <div className={styles.patientAppointmentsOverview}>
        <PatientAppointmentsHeader patient={response.patient} />
        <PatientAppointmentsBase patientUuid={response.patient.id} />
        <WorkspaceContainer overlay contextKey={`patient/${params.patientUuid}`} />
      </div>
    </PatientAppointmentContext.Provider>
  );
};

export default PatientAppointmentsOverview;
