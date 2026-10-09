import { type Session, userHasAccess } from '@openmrs/esm-framework';

import { maternalHealthPrivileges, maternalPatientChartPrivilege } from '../constants';

export function canViewMaternalProgram(session: Session | null | undefined): boolean {
  return Boolean(
    session?.authenticated &&
      session.user?.uuid &&
      userHasAccess(maternalPatientChartPrivilege, session.user) &&
      maternalHealthPrivileges.some(({ view }) => userHasAccess(view, session.user)),
  );
}

export function canRegisterMaternalForm(session: Session | null | undefined): boolean {
  return (
    canViewMaternalProgram(session) &&
    maternalHealthPrivileges.some(
      ({ view, edit }) => userHasAccess(view, session?.user) && userHasAccess(edit, session?.user),
    )
  );
}
