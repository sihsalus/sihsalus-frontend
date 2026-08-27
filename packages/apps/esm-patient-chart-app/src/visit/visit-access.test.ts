import { userHasAccess } from '@openmrs/esm-framework';

import { canCloseClinicalVisit, canEditVisit, canManuallyStartVisit, canStartVisit } from './visit-access';

const mockUserHasAccess = vi.mocked(userHasAccess);

type TestUser = Parameters<typeof userHasAccess>[1];

function buildUser({ privileges = [], roles = [] }: { privileges?: Array<string>; roles?: Array<string> } = {}) {
  return {
    privileges: privileges.map((name) => ({ uuid: name, name, display: name })),
    roles: roles.map((name) => ({ uuid: name, name, display: name })),
  } as TestUser;
}

/** Mirrors the real `userHasAccess`, which grants a super user every privilege. */
function grantPrivileges(...granted: Array<string>) {
  mockUserHasAccess.mockImplementation((privilege) => granted.includes(privilege as string));
}

function grantEverything() {
  mockUserHasAccess.mockReturnValue(true);
}

describe('canStartVisit', () => {
  beforeEach(() => {
    mockUserHasAccess.mockReset();
  });

  it('accepts the native OpenMRS Add Visits privilege', () => {
    grantPrivileges('Add Visits');

    expect(canStartVisit(buildUser())).toBe(true);
    expect(mockUserHasAccess).toHaveBeenCalledWith('Add Visits', expect.anything());
  });

  it('keeps the existing admission and clinical visit privileges compatible', () => {
    grantPrivileges('app:home.admision');
    expect(canStartVisit(buildUser())).toBe(true);

    grantPrivileges('app:hoja.clinica.visitas.editar');
    expect(canStartVisit(buildUser())).toBe(true);
  });

  it('rejects users without any supported visit creation privilege', () => {
    mockUserHasAccess.mockReturnValue(false);

    expect(canStartVisit(buildUser())).toBe(false);
  });
});

describe('canEditVisit', () => {
  beforeEach(() => {
    mockUserHasAccess.mockReset();
  });

  it('accepts the native OpenMRS Edit Visits privilege', () => {
    grantPrivileges('Edit Visits');

    expect(canEditVisit(buildUser())).toBe(true);
  });

  it('does not treat Add Visits alone as permission to edit', () => {
    grantPrivileges('Add Visits');

    expect(canEditVisit(buildUser())).toBe(false);
  });
});

describe('canCloseClinicalVisit', () => {
  beforeEach(() => {
    mockUserHasAccess.mockReset();
  });

  it('requires both clinical chart access and clinical visit editing', () => {
    grantPrivileges('app:hoja.clinica', 'app:hoja.clinica.visitas.editar');

    expect(
      canCloseClinicalVisit(buildUser({ privileges: ['app:hoja.clinica', 'app:hoja.clinica.visitas.editar'] })),
    ).toBe(true);
  });

  it('does not let admission close a clinical visit through its native visit capabilities', () => {
    grantPrivileges('app:home.admision', 'Add Visits', 'Edit Visits');

    expect(canCloseClinicalVisit(buildUser({ privileges: ['app:home.admision', 'Add Visits', 'Edit Visits'] }))).toBe(
      false,
    );
  });

  it('lets a clinician who also covers admission close the visit', () => {
    const privileges = ['app:home.admision', 'Add Encounters', 'app:hoja.clinica', 'app:hoja.clinica.visitas.editar'];
    grantPrivileges(...privileges);

    expect(canCloseClinicalVisit(buildUser({ privileges }))).toBe(true);
  });

  it('keeps clinical closure hidden from admission staff who can open the chart but not record encounters', () => {
    // The legacy `SIHSALUS Admision` role grants chart access and even
    // `visitas.editar` for check-in, with no clinical writing capability.
    const privileges = ['app:home.admision', 'app:hoja.clinica', 'app:hoja.clinica.visitas.editar', 'Edit Visits'];
    grantPrivileges(...privileges);

    expect(canCloseClinicalVisit(buildUser({ privileges }))).toBe(false);
  });

  it('still lets a super user close a clinical visit', () => {
    grantEverything();

    expect(canCloseClinicalVisit(buildUser({ roles: ['System Developer'] }))).toBe(true);
    expect(canCloseClinicalVisit(buildUser({ roles: ['Application: Has Super User Privileges'] }))).toBe(true);
  });

  it('rejects a stale clinical edit privilege without access to the clinical chart', () => {
    grantPrivileges('app:hoja.clinica.visitas.editar');

    expect(canCloseClinicalVisit(buildUser({ privileges: ['app:hoja.clinica.visitas.editar'] }))).toBe(false);
  });
});

describe('canManuallyStartVisit', () => {
  beforeEach(() => {
    mockUserHasAccess.mockReset();
  });

  it('allows a clinical user who can create visits', () => {
    grantPrivileges('app:hoja.clinica', 'Add Visits');

    expect(canManuallyStartVisit(buildUser({ privileges: ['app:hoja.clinica', 'Add Visits'] }))).toBe(true);
  });

  it('does not let admission bypass appointment arrival and queue routing', () => {
    grantPrivileges('app:home.admision', 'Add Visits');

    expect(canManuallyStartVisit(buildUser({ privileges: ['app:home.admision', 'Add Visits'] }))).toBe(false);
  });

  it('lets a clinician who also covers admission start a visit manually', () => {
    const privileges = ['app:home.admision', 'Add Encounters', 'app:hoja.clinica', 'Add Visits'];
    grantPrivileges(...privileges);

    expect(canManuallyStartVisit(buildUser({ privileges }))).toBe(true);
  });

  it('keeps manual start hidden from admission staff who can open the chart but not record encounters', () => {
    const privileges = ['app:home.admision', 'app:hoja.clinica', 'Add Visits'];
    grantPrivileges(...privileges);

    expect(canManuallyStartVisit(buildUser({ privileges }))).toBe(false);
  });

  it('still lets a super user start a visit manually', () => {
    grantEverything();

    expect(canManuallyStartVisit(buildUser({ roles: ['System Developer'] }))).toBe(true);
  });
});
