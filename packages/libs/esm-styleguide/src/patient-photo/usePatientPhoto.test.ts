import { openmrsFetch, restBaseUrl } from '@openmrs/esm-api';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePatientPhoto } from './usePatientPhoto';

const mocks = vi.hoisted(() => ({
  useConfig: vi.fn(),
  useSWR: vi.fn(),
}));

vi.mock('@openmrs/esm-react-utils', () => ({
  useConfig: mocks.useConfig,
}));

vi.mock('swr', () => ({
  default: mocks.useSWR,
}));

describe('usePatientPhoto', () => {
  beforeEach(() => {
    mocks.useConfig.mockReturnValue({ patientPhotoConceptUuid: 'patient-photo-concept-uuid' });
    mocks.useSWR.mockReturnValue({
      data: null,
      error: undefined,
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fetches patient photo observations by configured concept', () => {
    renderHook(() => usePatientPhoto('patient-uuid'));

    expect(mocks.useSWR).toHaveBeenCalledWith(
      `${restBaseUrl}/obs?patient=patient-uuid&concept=patient-photo-concept-uuid&v=full`,
      openmrsFetch,
    );
  });

  it('returns the most recent patient photo observation', () => {
    mocks.useSWR.mockReturnValue({
      data: {
        data: {
          results: [
            {
              display: 'Old patient photo',
              obsDatetime: '2026-05-28T05:00:00.000Z',
              uuid: 'old-obs-uuid',
              value: { display: 'old', links: { rel: 'value', uri: '/old-photo.jpg' } },
            },
            {
              display: 'New patient photo',
              obsDatetime: '2026-05-29T05:00:00.000Z',
              uuid: 'new-obs-uuid',
              value: { display: 'new', links: { rel: 'value', uri: '/new-photo.jpg' } },
            },
          ],
        },
      },
      error: undefined,
      isLoading: false,
    });

    const { result } = renderHook(() => usePatientPhoto('patient-uuid'));

    expect(result.current.data).toEqual({
      dateTime: '2026-05-29T05:00:00.000Z',
      imageSrc: '/new-photo.jpg',
    });
  });

  it('does not fetch when patient photos are not configured', () => {
    mocks.useConfig.mockReturnValue({ patientPhotoConceptUuid: null });

    renderHook(() => usePatientPhoto('patient-uuid'));

    expect(mocks.useSWR).toHaveBeenCalledWith(null, openmrsFetch);
  });
});
