import { showSnackbar } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { assignStudy, useStudiesByPatient } from '../../api';
import UnlinkStudyModal from './unlink-study.modal';

// Mock translation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (str: string, fallback: string) => fallback,
  }),
}));

vi.mock('@openmrs/esm-framework', () => ({
  showSnackbar: vi.fn(),
}));

vi.mock('../../api', () => ({
  useStudiesByPatient: vi.fn(),
  assignStudy: vi.fn(),
}));

describe('UnlinkStudyModal', () => {
  const mockMutate = vi.fn();
  const mockClose = vi.fn();
  const studyId = 123;
  const patientUuid = 'patient-uuid';

  beforeEach(() => {
    vi.clearAllMocks();
    (useStudiesByPatient as vi.Mock).mockReturnValue({ mutate: mockMutate });
  });

  it('renders correctly', () => {
    render(<UnlinkStudyModal closeUnlinkModal={mockClose} studyId={studyId} patientUuid={patientUuid} />);

    expect(screen.getByText(/Are you sure you want to unlink this study from the patient\?/i)).toBeInTheDocument();

    expect(screen.getByText('Unlink')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls assignStudy and handles success flow', async () => {
    (assignStudy as vi.Mock).mockResolvedValueOnce({ ok: true });

    render(<UnlinkStudyModal closeUnlinkModal={mockClose} studyId={studyId} patientUuid={patientUuid} />);

    fireEvent.click(screen.getByText('Unlink'));

    expect(assignStudy).toHaveBeenCalledWith(studyId, patientUuid, false, expect.any(AbortController));
    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    await waitFor(() => expect(mockClose).toHaveBeenCalled());
    await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' })));
  });

  it('handles error flow correctly', async () => {
    (assignStudy as vi.Mock).mockRejectedValueOnce(new Error('unlink failed'));

    render(<UnlinkStudyModal closeUnlinkModal={mockClose} studyId={studyId} patientUuid={patientUuid} />);

    fireEvent.click(screen.getByText('Unlink'));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle: 'unlink failed',
        }),
      ),
    );
    expect(mockMutate).not.toHaveBeenCalled();
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('disables unlink button and shows loader while deleting', async () => {
    let resolvePromise: Function;

    const pendingPromise = new Promise((resolve) => (resolvePromise = resolve));
    (assignStudy as vi.Mock).mockReturnValue(pendingPromise);

    render(<UnlinkStudyModal closeUnlinkModal={mockClose} studyId={studyId} patientUuid={patientUuid} />);

    const unlinkButton = screen.getByRole('button', { name: /unlink/i });
    fireEvent.click(unlinkButton);

    expect(unlinkButton).toBeDisabled();
    expect(screen.getByText('Unlinking...')).toBeInTheDocument();

    resolvePromise({});
  });
});
