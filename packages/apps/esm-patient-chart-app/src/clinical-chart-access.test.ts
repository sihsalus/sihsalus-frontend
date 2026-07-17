import { userHasAccess } from '@openmrs/esm-framework';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicalChartPrivilege } from './constants';
import { hasClinicalChartAccess } from './clinical-chart-access';

const mockUserHasAccess = vi.mocked(userHasAccess);

describe('hasClinicalChartAccess', () => {
  beforeEach(() => {
    mockUserHasAccess.mockReset();
  });

  it('delegates chart authorization to the shared privilege evaluator', () => {
    const user = {
      privileges: [{ display: clinicalChartPrivilege }],
      roles: [{ display: 'Any operational role' }],
    };
    mockUserHasAccess.mockReturnValue(true);

    expect(hasClinicalChartAccess(user)).toBe(true);
    expect(mockUserHasAccess).toHaveBeenCalledWith(clinicalChartPrivilege, user);
  });

  it('denies access when the shared privilege evaluator denies it', () => {
    const user = {
      privileges: [{ display: 'app:home.admision' }],
      roles: [{ display: 'SIHSALUS Admision' }],
    };
    mockUserHasAccess.mockReturnValue(false);

    expect(hasClinicalChartAccess(user)).toBe(false);
  });

  it('denies access before the user is available', () => {
    expect(hasClinicalChartAccess(undefined)).toBe(false);
    expect(mockUserHasAccess).not.toHaveBeenCalled();
  });
});
