import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  clearClinicalSearchTarget,
  selectClinicalSearchTarget,
  useClinicalSearchTarget,
} from './clinical-search-target';

describe('clinical search target', () => {
  it('only exposes a selected record to its patient and clears the exact selection', () => {
    const target = {
      kind: 'condition' as const,
      patientUuid: 'synthetic-patient-1',
      resourceId: 'synthetic-condition-1',
    };
    const currentPatient = renderHook(() => useClinicalSearchTarget('synthetic-patient-1', 'condition'));
    const anotherPatient = renderHook(() => useClinicalSearchTarget('synthetic-patient-2', 'condition'));

    act(() => selectClinicalSearchTarget(target));
    expect(currentPatient.result.current).toBe(target);
    expect(anotherPatient.result.current).toBeNull();

    act(() => clearClinicalSearchTarget({ ...target }));
    expect(currentPatient.result.current).toBe(target);

    act(() => clearClinicalSearchTarget(target));
    expect(currentPatient.result.current).toBeNull();
  });
});
