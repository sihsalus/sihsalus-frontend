import { showSnackbar } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { updateStudyLinkStatus, useStudiesByPatient } from '../../api';
import LinkingStudyModal from './link-study-confirmation.modal';

vi.mock('@openmrs/esm-framework', () => ({
  showSnackbar: vi.fn(),
  useLayoutType: vi.fn(() => 'desktop'),
}));

vi.mock('../../api', () => ({
  updateStudyLinkStatus: vi.fn(),
  useStudiesByPatient: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

describe('LinkingStudyModal', () => {
  const closeModalMock = vi.fn();
  const mutateMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useStudiesByPatient as vi.Mock).mockReturnValue({ mutate: mutateMock });
  });

  const defaultProps = {
    closeLinkingStudyModal: closeModalMock,
    linkStatus: 1,
    comparisonResult: JSON.stringify({
      score: 85,
      differences: [
        { tag: 'Name', fromOpenmrs: 'John Doe', fromPacs: 'John D.' },
        { tag: 'DOB', fromOpenmrs: '1990-01-01', fromPacs: '1990-01-02' },
      ],
    }),
    studyId: 123,
    patientUuid: 'patient-uuid-123',
  };

  it('renders modal with calculated score and table', () => {
    render(<LinkingStudyModal {...defaultProps} />);

    expect(screen.getByText(/Calculated matching score/i)).toHaveTextContent('Calculated matching score: 85');
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('John D.')).toBeInTheDocument();
  });

  it('shows empty state when no differences', () => {
    const props = { ...defaultProps, comparisonResult: JSON.stringify({ score: 0, differences: [] }) };
    render(<LinkingStudyModal {...props} />);
    expect(screen.getByText('No comparison data available')).toBeInTheDocument();
  });

  it('calls closeModal when close button clicked', () => {
    render(<LinkingStudyModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('footer-close-button'));
    expect(closeModalMock).toHaveBeenCalled();
  });

  it('calls confirm API and shows success snackbar', async () => {
    (updateStudyLinkStatus as vi.Mock).mockResolvedValueOnce({});
    render(<LinkingStudyModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(updateStudyLinkStatus).toHaveBeenCalledWith(1, 123, expect.any(AbortController));
      expect(mutateMock).toHaveBeenCalled();
      expect(closeModalMock).toHaveBeenCalled();
      expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
    });
  });

  it('shows error snackbar on API failure', async () => {
    (updateStudyLinkStatus as vi.Mock).mockRejectedValueOnce(new Error('API Error'));
    render(<LinkingStudyModal {...defaultProps} />);

    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle: 'API Error',
        }),
      );
    });
  });
});
