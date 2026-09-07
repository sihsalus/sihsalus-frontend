import { render, screen } from '@testing-library/react';
import { mockAppointmentsData } from 'test-utils';

import { type Appointment } from '../types';
import PatientAppointmentsTable from './patient-appointments-table.component';

interface MockAppointmentsActionsProps {
  appointment: Appointment;
  checkInOnly?: boolean;
}

const mockAppointmentsActions = vi.fn((_props: MockAppointmentsActionsProps) => (
  <button type="button">Registrar llegada</button>
));

vi.mock('../appointments/common-components/appointments-actions.component', () => ({
  default: (props) => mockAppointmentsActions(props),
}));

vi.mock('./patient-appointments-action-menu.component', () => ({
  PatientAppointmentsActionMenu: () => <button type="button">Más acciones</button>,
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  PatientChartPagination: () => <div>Paginación</div>,
}));

describe('PatientAppointmentsTable', () => {
  const appointment = mockAppointmentsData.data[0] as unknown as Appointment;

  it('places chart check-in in a visible care column and keeps secondary data in the responsive detail', () => {
    render(
      <PatientAppointmentsTable
        allowCheckIn
        patientAppointments={[appointment]}
        patientUuid={appointment.patient.uuid}
        setSwitchedView={vi.fn()}
        switchedView={false}
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Atención' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar llegada' })).toBeInTheDocument();
    expect(screen.getAllByText('Walk in appointments')).toHaveLength(2);
    expect(mockAppointmentsActions).toHaveBeenCalledWith(
      expect.objectContaining({
        appointment,
        checkInOnly: true,
      }),
    );
  });
});
