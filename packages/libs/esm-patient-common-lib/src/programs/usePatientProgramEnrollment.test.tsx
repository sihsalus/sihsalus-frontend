import { renderHook } from '@testing-library/react';

import type { PatientProgram } from '../types';
import { useActivePatientEnrollment } from './usePatientProgramEnrollment';

const mockUsePatientEnrollment = vi.hoisted(() => vi.fn());

vi.mock('../clinical-view-group/clinical-view-group.resource', () => ({
  usePatientEnrollment: mockUsePatientEnrollment,
}));

describe('useActivePatientEnrollment', () => {
  beforeEach(() => {
    mockUsePatientEnrollment.mockReset();
  });

  it('delegates to the shared enrollment hook and preserves its public contract', () => {
    const activePatientEnrollment = [{ uuid: 'enrollment-uuid' }] as Array<PatientProgram>;
    const error = new Error('request failed');
    mockUsePatientEnrollment.mockReturnValue({
      activePatientEnrollment,
      patientEnrollments: [{ uuid: 'completed-enrollment' }],
      error,
      isLoading: true,
      isValidating: true,
    });

    const { result } = renderHook(() => useActivePatientEnrollment('patient-uuid'));

    expect(mockUsePatientEnrollment).toHaveBeenCalledOnce();
    expect(mockUsePatientEnrollment).toHaveBeenCalledWith('patient-uuid');
    expect(result.current).toEqual({ activePatientEnrollment, error, isLoading: true });
  });

  it.each([
    undefined,
    null,
    '',
    '   ',
  ])('passes an absent patient UUID to the guarded shared hook (%s)', (patientUuid) => {
    mockUsePatientEnrollment.mockReturnValue({
      activePatientEnrollment: [],
      patientEnrollments: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
    });

    const { result } = renderHook(() => useActivePatientEnrollment(patientUuid));

    expect(mockUsePatientEnrollment).toHaveBeenCalledWith(patientUuid);
    expect(result.current).toEqual({ activePatientEnrollment: [], error: undefined, isLoading: false });
  });
});
