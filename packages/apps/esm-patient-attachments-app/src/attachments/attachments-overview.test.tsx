import { showModal, showSnackbar, useAttachments, userHasAccess } from '@openmrs/esm-framework';
import { useAllowedFileExtensions } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import AttachmentsOverview from './attachments-overview.component';

vi.mock('@openmrs/esm-patient-common-lib', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-patient-common-lib')>()),
  useAllowedFileExtensions: vi.fn(),
}));

const mockUseAttachments = vi.mocked(useAttachments);
const mockShowModal = vi.mocked(showModal);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUserHasAccess = vi.mocked(userHasAccess);
const mockUseAllowedFileExtensions = vi.mocked(useAllowedFileExtensions);
mockUserHasAccess.mockReturnValue(true);

beforeEach(() => {
  mockUseAllowedFileExtensions.mockReturnValue({
    allowedFileExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    error: undefined,
    isConfigured: true,
    isLoading: false,
  });
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
