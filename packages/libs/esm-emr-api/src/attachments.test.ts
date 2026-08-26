import { openmrsFetch } from '@openmrs/esm-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { attachmentUrl, createAttachment } from './attachments';

vi.mock('@openmrs/esm-api', () => ({
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('createAttachment', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockResolvedValue({} as Awaited<ReturnType<typeof openmrsFetch>>);
  });

  it('forwards the caller abort signal to the upload request', async () => {
    const signal = new AbortController().signal;

    await createAttachment(
      'patient-uuid',
      {
        base64Content: 'data:image/png;base64,aGVsbG8=',
        file: new File(['hello'], 'patient-photo.png', { type: 'image/png' }),
        fileDescription: 'Patient photo',
        fileName: 'patient-photo.png',
        fileType: 'image',
      },
      signal,
    );

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(attachmentUrl, {
      method: 'POST',
      body: expect.any(FormData),
      signal,
    });
  });

  it('adds exact encounter and form-field metadata when clinical context is supplied', async () => {
    await createAttachment(
      'patient-uuid',
      {
        base64Content: 'data:application/pdf;base64,aGVsbG8=',
        file: new File(['hello'], 'result.pdf', { type: 'application/pdf' }),
        fileDescription: 'Supplemental laboratory document',
        fileName: 'result.pdf',
        fileType: 'pdf',
      },
      undefined,
      {
        encounterUuid: 'encounter-uuid',
        formFieldNamespace: 'sihsalus-laboratory',
        formFieldPath: 'sihsalus-laboratory-order-order-uuid-supplemental-pdf',
      },
    );

    const request = mockOpenmrsFetch.mock.calls[0][1];
    const body = request?.body as FormData;

    expect(body.get('patient')).toBe('patient-uuid');
    expect(body.get('encounter')).toBe('encounter-uuid');
    expect(body.get('formFieldNamespace')).toBe('sihsalus-laboratory');
    expect(body.get('formFieldPath')).toBe('sihsalus-laboratory-order-order-uuid-supplemental-pdf');
  });
});
