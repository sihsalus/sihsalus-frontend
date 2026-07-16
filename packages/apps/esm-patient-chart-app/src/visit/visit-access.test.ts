import { userHasAccess } from '@openmrs/esm-framework';

import { canEditVisit, canStartVisit } from './visit-access';

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
