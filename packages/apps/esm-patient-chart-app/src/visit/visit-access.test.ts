import { userHasAccess } from '@openmrs/esm-framework';

import { canCloseClinicalVisit, canEditVisit, canStartVisit } from './visit-access';

const mockUserHasAccess = vi.mocked(userHasAccess);

describe('canStartVisit', () => {
  beforeEach(() => {
    mockUserHasAccess.mockReset();
  });

  it('accepts the native OpenMRS Add Visits privilege', () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege === 'Add Visits');

    expect(canStartVisit({} as Parameters<typeof userHasAccess>[1])).toBe(true);
    expect(mockUserHasAccess).toHaveBeenCalledWith('Add Visits', expect.anything());
  });

  it('keeps the existing admission and clinical visit privileges compatible', () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege === 'app:home.admision');
    expect(canStartVisit({} as Parameters<typeof userHasAccess>[1])).toBe(true);

    mockUserHasAccess.mockImplementation((privilege) => privilege === 'app:hoja.clinica.visitas.editar');
    expect(canStartVisit({} as Parameters<typeof userHasAccess>[1])).toBe(true);
  });

  it('rejects users without any supported visit creation privilege', () => {
    mockUserHasAccess.mockReturnValue(false);

    expect(canStartVisit({} as Parameters<typeof userHasAccess>[1])).toBe(false);
  });
});

describe('canEditVisit', () => {
  beforeEach(() => {
    mockUserHasAccess.mockReset();
  });

  it('accepts the native OpenMRS Edit Visits privilege', () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege === 'Edit Visits');

    expect(canEditVisit({} as Parameters<typeof userHasAccess>[1])).toBe(true);
  });

  it('does not treat Add Visits alone as permission to edit', () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege === 'Add Visits');

    expect(canEditVisit({} as Parameters<typeof userHasAccess>[1])).toBe(false);
  });
});

describe('canCloseClinicalVisit', () => {
  beforeEach(() => {
    mockUserHasAccess.mockReset();
  });

  it('requires both clinical chart access and clinical visit editing', () => {
    mockUserHasAccess.mockImplementation((privilege) =>
      ['app:hoja.clinica', 'app:hoja.clinica.visitas.editar'].includes(privilege as string),
    );

    expect(canCloseClinicalVisit({} as Parameters<typeof userHasAccess>[1])).toBe(true);
  });

  it('does not let admission close a clinical visit through its native visit capabilities', () => {
    mockUserHasAccess.mockImplementation((privilege) =>
      ['app:home.admision', 'Add Visits', 'Edit Visits'].includes(privilege as string),
    );

    expect(canCloseClinicalVisit({} as Parameters<typeof userHasAccess>[1])).toBe(false);
  });

  it('rejects a stale clinical edit privilege without access to the clinical chart', () => {
    mockUserHasAccess.mockImplementation((privilege) => privilege === 'app:hoja.clinica.visitas.editar');

    expect(canCloseClinicalVisit({} as Parameters<typeof userHasAccess>[1])).toBe(false);
  });
});
