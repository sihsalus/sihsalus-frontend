import { type LoggedInUser, userHasAccess } from '@openmrs/esm-framework';

import {
  canCreateAppointmentQueueEntry,
  canCreateAppointmentVisit,
  canInspectAppointmentVisits,
  canReuseAppointmentVisit,
} from './appointment-arrival-access';

const mockUserHasAccess = vi.mocked(userHasAccess);
const queueEntryPrivileges = [
  'Get Patients',
  'Get Locations',
  'Get Visits',
  'Edit Visits',
  'Get Visit Attribute Types',
  'Get Queue Entries',
  'Get Queues',
  'Manage Queue Entries',
];

function userWithPrivileges(privileges: Array<string>) {
  return {
    privileges: privileges.map((display) => ({ display })),
  } as unknown as LoggedInUser;
}

describe('appointment arrival access', () => {
  beforeEach(() => {
    mockUserHasAccess.mockImplementation((privilege, user) =>
      Boolean(user?.privileges?.some(({ display, name }) => display === privilege || name === privilege)),
    );
  });

  it.each([
    'Add Visits',
    'app:home.admision',
    'app:hoja.clinica.visitas.editar',
  ])('accepts %s as an alternative visit-creation capability, matching StartVisitFormGuard', (privilege) => {
    expect(canCreateAppointmentVisit(userWithPrivileges([privilege]))).toBe(true);
  });

  it('does not infer visit creation from read or edit REST privileges alone', () => {
    expect(canCreateAppointmentVisit(userWithPrivileges(['Get Visits', 'Edit Visits']))).toBe(false);
  });

  it('requires visit read, edit and attribute-type read access before reusing an active visit', () => {
    const requiredPrivileges = ['Get Visits', 'Edit Visits', 'Get Visit Attribute Types'];

    requiredPrivileges.forEach((missingPrivilege) => {
      expect(
        canReuseAppointmentVisit(
          userWithPrivileges(requiredPrivileges.filter((privilege) => privilege !== missingPrivilege)),
        ),
      ).toBe(false);
    });
    expect(canReuseAppointmentVisit(userWithPrivileges(requiredPrivileges))).toBe(true);
    expect(canInspectAppointmentVisits(userWithPrivileges(['Get Visits']))).toBe(true);
  });

  it('requires every native queue-entry dependency without requiring the Colas navigation privilege', () => {
    queueEntryPrivileges.forEach((missingPrivilege) => {
      expect(
        canCreateAppointmentQueueEntry(
          userWithPrivileges(queueEntryPrivileges.filter((privilege) => privilege !== missingPrivilege)),
        ),
      ).toBe(false);
    });

    expect(canCreateAppointmentQueueEntry(userWithPrivileges(queueEntryPrivileges))).toBe(true);
    expect(queueEntryPrivileges).not.toContain('app:home.colasAtencion.editar');
  });
});
