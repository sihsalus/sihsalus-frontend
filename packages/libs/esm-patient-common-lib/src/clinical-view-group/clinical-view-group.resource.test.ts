import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

import type { PatientProgram } from '../types';
import { usePatientEnrollment } from './clinical-view-group.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const swrWrapper = ({ children }: PropsWithChildren) =>
  createElement(
    SWRConfig,
    { value: { dedupingInterval: 0, provider: () => new Map(), shouldRetryOnError: false } },
    children,
  );

const enrollment = ({
  uuid,
  programUuid = `program-${uuid}`,
  dateEnrolled = '2026-01-01T00:00:00.000Z',
  dateCompleted = null,
  voided = false,
}: {
  uuid: string;
  programUuid?: string;
  dateEnrolled?: string;
  dateCompleted?: string | null;
  voided?: boolean;
}) =>
  ({
    uuid,
    program: { uuid: programUuid, name: `Program ${programUuid}` },
    dateEnrolled,
    dateCompleted,
    voided,
  }) as PatientProgram;

describe('usePatientEnrollment', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it.each([undefined, null, '', '   '])('does not fetch without a patient UUID (%s)', (patientUuid) => {
    const { result } = renderHook(() => usePatientEnrollment(patientUuid), { wrapper: swrWrapper });

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(result.current.patientEnrollments).toEqual([]);
    expect(result.current.activePatientEnrollment).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('trims the patient UUID before fetching and requests the fields used by the hook', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { results: [] } } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => usePatientEnrollment('  patient-uuid  '), { wrapper: swrWrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${restBaseUrl}/programenrollment\\?patient=patient-uuid&v=`)),
    );
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain('program:(uuid,name,display)');
    expect(mockOpenmrsFetch.mock.calls[0][0]).toContain('voided');
  });

  it('sorts without mutating the response, excludes voided records, and keeps the newest enrollment per program', async () => {
    const results = [
      enrollment({
        uuid: 'program-a-active',
        programUuid: 'program-a',
        dateEnrolled: '2026-05-01T00:00:00.000Z',
      }),
      enrollment({
        uuid: 'program-b-old',
        programUuid: 'program-b',
        dateEnrolled: '2026-03-01T00:00:00.000Z',
      }),
      enrollment({
        uuid: 'program-a-completed',
        programUuid: 'program-a',
        dateEnrolled: '2026-06-01T00:00:00.000Z',
        dateCompleted: '2026-06-20T00:00:00.000Z',
      }),
      enrollment({
        uuid: 'program-b-new',
        programUuid: 'program-b',
        dateEnrolled: '2026-07-01T00:00:00.000Z',
      }),
      enrollment({
        uuid: 'voided-enrollment',
        programUuid: 'program-c',
        dateEnrolled: '2026-08-01T00:00:00.000Z',
        voided: true,
      }),
      enrollment({ uuid: 'invalid-date', programUuid: 'program-d', dateEnrolled: 'not-a-date' }),
      enrollment({ uuid: 'missing-program-one', programUuid: '', dateEnrolled: '' }),
      enrollment({ uuid: 'missing-program-two', programUuid: '', dateEnrolled: '' }),
    ];
    const originalOrder = results.map(({ uuid }) => uuid);
    mockOpenmrsFetch.mockResolvedValue({ data: { results } } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => usePatientEnrollment('patient-uuid'), { wrapper: swrWrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(results.map(({ uuid }) => uuid)).toEqual(originalOrder);
    expect(result.current.patientEnrollments.map(({ uuid }) => uuid)).toEqual([
      'program-b-new',
      'program-a-completed',
      'invalid-date',
      'missing-program-one',
      'missing-program-two',
    ]);
    expect(result.current.activePatientEnrollment.map(({ uuid }) => uuid)).toEqual([
      'program-b-new',
      'program-a-active',
      'invalid-date',
      'missing-program-one',
      'missing-program-two',
    ]);
  });

  it('exposes fetch failures without manufacturing enrollment data', async () => {
    const fetchError = new Error('network unavailable');
    mockOpenmrsFetch.mockRejectedValue(fetchError);

    const { result } = renderHook(() => usePatientEnrollment('patient-uuid'), { wrapper: swrWrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe(fetchError);
    expect(result.current.patientEnrollments).toEqual([]);
    expect(result.current.activePatientEnrollment).toEqual([]);
  });
});
