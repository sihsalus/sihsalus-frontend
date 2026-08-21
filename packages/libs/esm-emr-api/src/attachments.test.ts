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
});
