import { openmrsFetch, restBaseUrl } from '@openmrs/esm-api';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePatientPhoto } from './usePatientPhoto';

const mocks = vi.hoisted(() => ({
  useConfig: vi.fn(),
  useSWR: vi.fn(),
}));

const legacyAttachmentImageConceptUuid = '7cac8397-53cd-4f00-a6fe-028e8d743f8e';

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

    expect(mocks.useSWR).toHaveBeenNthCalledWith(
      1,
      `${restBaseUrl}/obs?patient=patient-uuid&concept=patient-photo-concept-uuid&v=full`,
      openmrsFetch,
    );
    expect(mocks.useSWR).toHaveBeenNthCalledWith(
      2,
      `${restBaseUrl}/obs?patient=patient-uuid&concept=${legacyAttachmentImageConceptUuid}&v=full`,
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
    expect(mocks.useSWR).toHaveBeenNthCalledWith(2, null, openmrsFetch);
  });

  it('falls back to a marked legacy photo without treating a newer attachment as the avatar', () => {
    mocks.useSWR.mockImplementation((url: string | null) => {
      if (url?.includes(`concept=${legacyAttachmentImageConceptUuid}`)) {
        return {
          data: {
            data: {
              results: [
                {
                  comment: 'Clinical image',
                  display: 'Generic attachment',
                  obsDatetime: '2026-06-01T05:00:00.000Z',
                  uuid: 'generic-attachment-uuid',
                  value: { display: 'wound.png', links: { rel: 'value', uri: '/wound.png' } },
                },
                {
                  comment: 'Patient photo',
                  display: 'Legacy patient photo',
                  obsDatetime: '2026-05-29T05:00:00.000Z',
                  uuid: 'legacy-photo-uuid',
                  value: { display: 'legacy-name.png', links: { rel: 'value', uri: '/legacy-photo.png' } },
                },
              ],
            },
          },
          error: undefined,
          isLoading: false,
        };
      }

      return {
        data: { data: { results: [] } },
        error: undefined,
        isLoading: false,
      };
    });

    const { result } = renderHook(() => usePatientPhoto('patient-uuid'));

    expect(result.current.data).toEqual({
      dateTime: '2026-05-29T05:00:00.000Z',
      imageSrc: '/legacy-photo.png',
    });
  });

  it('filters the generic attachment concept when it is explicitly configured for legacy compatibility', () => {
    mocks.useConfig.mockReturnValue({ patientPhotoConceptUuid: legacyAttachmentImageConceptUuid });
    mocks.useSWR.mockReturnValue({
      data: {
        data: {
          results: [
            {
              display: 'Generic attachment',
              obsDatetime: '2026-06-01T05:00:00.000Z',
              uuid: 'generic-attachment-uuid',
              value: { display: 'scan.png', links: { rel: 'value', uri: '/scan.png' } },
            },
            {
              display: 'Attachment Image: ImageHandler|patient-photo.png',
              obsDatetime: '2026-05-29T05:00:00.000Z',
              uuid: 'legacy-photo-uuid',
              value: { display: 'raw file', links: { rel: 'value', uri: '/legacy-photo.png' } },
            },
          ],
        },
      },
      error: undefined,
      isLoading: false,
    });

    const { result } = renderHook(() => usePatientPhoto('patient-uuid'));

    expect(result.current.data?.imageSrc).toBe('/legacy-photo.png');
    expect(mocks.useSWR).toHaveBeenNthCalledWith(2, null, openmrsFetch);
  });

  it('does not hide a configured concept error by falling back to a legacy photo', () => {
    const primaryError = new Error('Unable to load the configured patient photo concept');
    mocks.useSWR.mockImplementation((url: string | null) => {
      if (!url) {
        return {
          data: null,
          error: undefined,
          isLoading: false,
        };
      }

      if (url?.includes('concept=patient-photo-concept-uuid')) {
        return {
          data: null,
          error: primaryError,
          isLoading: false,
        };
      }

      return {
        data: {
          data: {
            results: [
              {
                comment: 'Patient photo',
                display: 'Legacy patient photo',
                obsDatetime: '2026-05-29T05:00:00.000Z',
                uuid: 'legacy-photo-uuid',
                value: { display: 'raw file', links: { rel: 'value', uri: '/legacy-photo.png' } },
              },
            ],
          },
        },
        error: undefined,
        isLoading: false,
      };
    });

    const { result } = renderHook(() => usePatientPhoto('patient-uuid'));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe(primaryError);
    expect(mocks.useSWR).toHaveBeenNthCalledWith(2, null, openmrsFetch);
  });

  it('does not fetch when patient photos are not configured', () => {
    mocks.useConfig.mockReturnValue({ patientPhotoConceptUuid: null });

    renderHook(() => usePatientPhoto('patient-uuid'));

    expect(mocks.useSWR).toHaveBeenNthCalledWith(1, null, openmrsFetch);
    expect(mocks.useSWR).toHaveBeenNthCalledWith(2, null, openmrsFetch);
  });
});
