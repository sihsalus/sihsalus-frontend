import { useConfig, usePatient, useSession, userHasAccess } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import { patientVitalsEditPrivilege, serviceQueuesEditPrivilege, visitNotesEditPrivilege } from '../../constants';
import VisitNote from './visit-note.component';
import Vitals from './vitals.component';

vi.mock('../hooks/useVitalsConceptMetadata', () => ({
  useVitalsConceptMetadata: vi.fn(() => ({ data: new Map(), conceptMetadata: new Map() })),
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUsePatient = vi.mocked(usePatient);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);

function sessionWithPrivileges(...privileges: Array<string>) {
  return {
    user: {
      privileges: privileges.map((display) => ({ display, name: display })),
      roles: [],
    },
  } as ReturnType<typeof useSession>;
}

describe('embedded queue clinical workspace access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({ concepts: {}, biometrics: {} });
    mockUsePatient.mockReturnValue({ patient: { id: 'patient-uuid' } } as ReturnType<typeof usePatient>);
    mockUserHasAccess.mockImplementation((requiredPrivileges, user) => {
      const required = Array.isArray(requiredPrivileges) ? requiredPrivileges : [requiredPrivileges];
      const granted = new Set(user?.privileges?.map((privilege) => privilege.display));
      return required.every((privilege) => granted.has(privilege));
    });
  });

  it('hides clinical editor actions when the user only has the queue edit privilege', () => {
    mockUseSession.mockReturnValue(sessionWithPrivileges(serviceQueuesEditPrivilege));

    render(
      <>
        <Vitals vitals={[]} patientUuid="patient-uuid" visitType="currentVisit" />
        <VisitNote notes={[]} diagnoses={[]} patientUuid="patient-uuid" />
      </>,
    );

    expect(screen.queryByRole('button', { name: /Vitals form/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Visit note form/i })).not.toBeInTheDocument();
  });

  it('shows clinical editor actions only when queue and matching clinical privileges are granted', () => {
    mockUseSession.mockReturnValue(
      sessionWithPrivileges(serviceQueuesEditPrivilege, patientVitalsEditPrivilege, visitNotesEditPrivilege),
    );

    render(
      <>
        <Vitals vitals={[]} patientUuid="patient-uuid" visitType="currentVisit" />
        <VisitNote notes={[]} diagnoses={[]} patientUuid="patient-uuid" />
      </>,
    );

    expect(screen.getByRole('button', { name: /Vitals form/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Visit note form/i })).toBeInTheDocument();
  });
});
