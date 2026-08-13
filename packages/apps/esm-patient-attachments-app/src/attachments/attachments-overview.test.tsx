import {
  createAttachment,
  showModal,
  showSnackbar,
  type UploadedFile,
  useAttachments,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import { useAllowedFileExtensions } from '@openmrs/esm-patient-common-lib';
import { fireEvent, render, screen } from '@testing-library/react';
import AttachmentsOverview from './attachments-overview.component';

vi.mock('@openmrs/esm-patient-common-lib', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-patient-common-lib')>()),
  useAllowedFileExtensions: vi.fn(),
}));

const mockUseAttachments = vi.mocked(useAttachments);
const mockCreateAttachment = vi.mocked(createAttachment);
const mockShowModal = vi.mocked(showModal);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseSession = vi.mocked(useSession);
const mockUseAllowedFileExtensions = vi.mocked(useAllowedFileExtensions);
beforeEach(() => {
  vi.clearAllMocks();
  mockUseSession.mockReturnValue({
    authenticated: true,
    sessionId: 'session-id',
    user: { uuid: 'user-uuid' },
  } as ReturnType<typeof useSession>);
  mockUserHasAccess.mockReturnValue(true);
  mockUseAllowedFileExtensions.mockReturnValue({
    allowedFileExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    error: undefined,
    isConfigured: true,
    isLoading: false,
  });
});

it('disables attachment requests when the user lacks application access', () => {
  mockUserHasAccess.mockReturnValue(false);
  mockUseAttachments.mockReturnValue({
    data: [],
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  render(<AttachmentsOverview patientUuid="test-uuid" />);

  expect(mockUseAttachments).toHaveBeenCalledWith('test-uuid', true, false, 'session-id:user-uuid');
  expect(screen.queryByRole('heading', { name: 'Attachments' })).not.toBeInTheDocument();
});

it('disables attachment requests when the session is not authenticated', () => {
  mockUseSession.mockReturnValue({
    authenticated: false,
    sessionId: '',
    user: { uuid: 'user-uuid' },
  } as ReturnType<typeof useSession>);
  mockUseAttachments.mockReturnValue({
    data: [],
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  render(<AttachmentsOverview patientUuid="test-uuid" />);

  expect(mockUseAttachments).toHaveBeenCalledWith('test-uuid', true, false, undefined);
  expect(screen.queryByRole('heading', { name: 'Attachments' })).not.toBeInTheDocument();
});

it('still renders when the backend session has no sessionId', () => {
  // Newer webservices.rest omits sessionId from /session (QLTY runs such a
  // backend). Reading attachments only needs an authenticated user with the
  // privilege; the cache scope falls back to a per-user key.
  mockUseSession.mockReturnValue({
    authenticated: true,
    user: { uuid: 'user-uuid' },
  } as ReturnType<typeof useSession>);
  mockUseAttachments.mockReturnValue({
    data: [],
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  render(<AttachmentsOverview patientUuid="test-uuid" />);

  expect(mockUseAttachments).toHaveBeenCalledWith('test-uuid', true, true, 'no-session-id:user-uuid');
  expect(screen.getByRole('heading', { name: 'Attachments' })).toBeInTheDocument();
});

it('shows an error state instead of an empty state when attachments cannot be read', () => {
  mockUseAttachments.mockReturnValue({
    data: [],
    error: new Error('Missing View Attachments privilege'),
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  render(<AttachmentsOverview patientUuid="test-uuid" />);

  expect(screen.getByRole('heading', { name: 'Attachments' })).toBeInTheDocument();
  expect(screen.queryByText(/There are no attachments to display for this patient/i)).not.toBeInTheDocument();
});

it('keeps cached attachments visible with a warning when a network refresh fails', () => {
  mockUseAttachments.mockReturnValue({
    data: [
      {
        bytesContentFamily: 'IMAGE',
        bytesMimeType: 'image/png',
        comment: 'Cached clinical image',
        dateTime: '2026-08-03T12:00:00.000Z',
        filename: 'cached-image.png',
        uuid: 'cached-attachment-uuid',
      },
    ],
    error: new TypeError('Failed to fetch'),
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  render(<AttachmentsOverview patientUuid="test-uuid" />);

  expect(screen.getByText('cached-image')).toBeInTheDocument();
  expect(screen.getByText(/This list may be out of date/i)).toBeInTheDocument();
});

it('keeps cached attachments visible with a warning when the server refresh fails', () => {
  mockUseAttachments.mockReturnValue({
    data: [
      {
        bytesContentFamily: 'IMAGE',
        bytesMimeType: 'image/png',
        comment: 'Cached clinical image',
        dateTime: '2026-08-03T12:00:00.000Z',
        filename: 'cached-image.png',
        uuid: 'cached-attachment-uuid',
      },
    ],
    error: Object.assign(new Error('Internal server error'), { response: { status: 500 } }),
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  render(<AttachmentsOverview patientUuid="test-uuid" />);

  expect(screen.getByText('cached-image')).toBeInTheDocument();
  expect(screen.getByText(/This list may be out of date/i)).toBeInTheDocument();
});

it('keeps cached attachments visible with a warning when the server rate limits refreshes', () => {
  mockUseAttachments.mockReturnValue({
    data: [
      {
        bytesContentFamily: 'IMAGE',
        bytesMimeType: 'image/png',
        comment: 'Cached clinical image',
        dateTime: '2026-08-03T12:00:00.000Z',
        filename: 'cached-image.png',
        uuid: 'cached-attachment-uuid',
      },
    ],
    error: Object.assign(new Error('Too many requests'), { response: { status: 429 } }),
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  render(<AttachmentsOverview patientUuid="test-uuid" />);

  expect(screen.getByText('cached-image')).toBeInTheDocument();
  expect(screen.getByText(/This list may be out of date/i)).toBeInTheDocument();
});

it.each([401, 403])('hides cached attachments after an HTTP %s response', (status) => {
  const mutate = vi.fn();
  mockUseAttachments.mockReturnValue({
    data: [
      {
        bytesContentFamily: 'IMAGE',
        bytesMimeType: 'image/png',
        comment: 'Private clinical image',
        dateTime: '2026-08-03T12:00:00.000Z',
        filename: 'private-image.png',
        uuid: 'private-attachment-uuid',
      },
    ],
    error: Object.assign(new Error(`HTTP ${status}`), { response: { status } }),
    isLoading: false,
    isValidating: false,
    mutate,
  });

  const { rerender } = render(<AttachmentsOverview patientUuid="test-uuid" />);

  expect(screen.queryByText('private-image')).not.toBeInTheDocument();
  expect(screen.getByText(/There was a problem displaying this information/i)).toBeInTheDocument();
  expect(mutate).not.toHaveBeenCalled();

  rerender(<AttachmentsOverview patientUuid="test-uuid" />);

  expect(screen.queryByText('private-image')).not.toBeInTheDocument();
  expect(screen.queryByText(/There are no attachments to display for this patient/i)).not.toBeInTheDocument();
});

it('fails closed for an unrecognized error shape', () => {
  mockUseAttachments.mockReturnValue({
    data: [
      {
        bytesContentFamily: 'IMAGE',
        bytesMimeType: 'image/png',
        comment: 'Private clinical image',
        dateTime: '2026-08-03T12:00:00.000Z',
        filename: 'private-image.png',
        uuid: 'private-attachment-uuid',
      },
    ],
    error: new Error('Unexpected attachment failure'),
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  render(<AttachmentsOverview patientUuid="test-uuid" />);

  expect(screen.queryByText('private-image')).not.toBeInTheDocument();
  expect(screen.getByText(/There was a problem displaying this information/i)).toBeInTheDocument();
});

it('does not retain an open preview when the patient changes', () => {
  mockUseAttachments.mockReturnValue({
    data: [
      {
        bytesContentFamily: 'IMAGE',
        bytesMimeType: 'image/png',
        comment: 'Patient A image',
        dateTime: '2026-08-03T12:00:00.000Z',
        filename: 'patient-a-image.png',
        uuid: 'patient-a-attachment-uuid',
      },
    ],
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  const { rerender } = render(<AttachmentsOverview patientUuid="patient-a-uuid" />);

  fireEvent.click(screen.getByRole('button', { name: 'patient-a-image' }));
  expect(screen.getByRole('dialog', { name: /attachment preview/i })).toBeInTheDocument();

  rerender(<AttachmentsOverview patientUuid="patient-b-uuid" />);

  expect(screen.queryByRole('dialog', { name: /attachment preview/i })).not.toBeInTheDocument();
});

it('does not retain an open preview when the authenticated session changes', () => {
  mockUseAttachments.mockReturnValue({
    data: [
      {
        bytesContentFamily: 'IMAGE',
        bytesMimeType: 'image/png',
        comment: 'Patient image',
        dateTime: '2026-08-03T12:00:00.000Z',
        filename: 'patient-image.png',
        uuid: 'patient-attachment-uuid',
      },
    ],
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  const { rerender } = render(<AttachmentsOverview patientUuid="patient-uuid" />);

  fireEvent.click(screen.getByRole('button', { name: 'patient-image' }));
  expect(screen.getByRole('dialog', { name: /attachment preview/i })).toBeInTheDocument();

  mockUseSession.mockReturnValue({
    authenticated: true,
    sessionId: 'other-session-id',
    user: { uuid: 'other-user-uuid' },
  } as ReturnType<typeof useSession>);
  rerender(<AttachmentsOverview patientUuid="patient-uuid" />);

  expect(screen.queryByRole('dialog', { name: /attachment preview/i })).not.toBeInTheDocument();
});

it('renders a loading skeleton when attachments are loading', () => {
  mockUseAttachments.mockReturnValue({
    data: [],
    error: null,
    isLoading: true,
    isValidating: false,
    mutate: vi.fn(),
  });

  render(<AttachmentsOverview patientUuid="test-uuid" />);

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('renders an empty state if attachments are not available', () => {
  mockUseAttachments.mockReturnValue({
    data: [],
    error: null,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });

  render(<AttachmentsOverview patientUuid="test-uuid" />);

  expect(screen.getByText(/There are no attachments to display for this patient/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /record attachments/i })).toBeInTheDocument();
});

it('persists files from the uploader through the attachments endpoint callback', async () => {
  const mutate = vi.fn();
  mockUseAttachments.mockReturnValue({
    data: [],
    error: null,
    isLoading: false,
    isValidating: false,
    mutate,
  });
  mockCreateAttachment.mockResolvedValue({} as Awaited<ReturnType<typeof createAttachment>>);

  render(<AttachmentsOverview patientUuid="test-uuid" />);

  screen.getByRole('button', { name: /record attachments/i }).click();

  expect(mockShowModal).toHaveBeenCalledWith(
    'capture-photo-modal',
    expect.objectContaining({
      collectDescription: true,
      multipleFiles: true,
    }),
  );

  const modalOptions = mockShowModal.mock.calls[0][1] as {
    onCompletion: () => void;
    saveFile: (file: UploadedFile) => ReturnType<typeof createAttachment>;
  };
  const file = {
    base64Content: 'data:image/png;base64,aGVsbG8=',
    fileDescription: 'Clinical image',
    fileName: 'clinical-image.png',
    fileType: 'image',
  } as UploadedFile;

  await modalOptions.saveFile(file);
  modalOptions.onCompletion();

  expect(mockCreateAttachment).toHaveBeenCalledWith('test-uuid', file);
  expect(mutate).toHaveBeenCalledOnce();
});

it('does not open the uploader when the server allowlist is missing', () => {
  mockUseAttachments.mockReturnValue({
    data: [],
    error: null,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  });
  mockUseAllowedFileExtensions.mockReturnValue({
    allowedFileExtensions: [],
    error: undefined,
    isConfigured: false,
    isLoading: false,
  });

  render(<AttachmentsOverview patientUuid="test-uuid" />);

  screen.getByRole('button', { name: /record attachments/i }).click();

  expect(mockShowModal).not.toHaveBeenCalled();
  expect(mockShowSnackbar).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 'error',
      subtitle: expect.stringMatching(/No permitted attachment types have been configured/i),
    }),
  );
});
