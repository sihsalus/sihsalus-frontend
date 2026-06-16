import { type FetchResponse, showSnackbar, updateVisit, useVisit, type Visit } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockCurrentVisit } from 'test-utils';

import EndVisitDialog from './end-visit-dialog.component';

const endVisitPayload = {
  stopDatetime: expect.any(Date),
};

const mockCloseModal = vi.fn();
const mockMutate = vi.fn();
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseVisit = vi.mocked(useVisit);
const mockUpdateVisit = vi.mocked(updateVisit);

describe('End visit dialog', () => {
  beforeEach(() => {
    mockUseVisit.mockReturnValue({
      activeVisit: mockCurrentVisit,
      currentVisit: mockCurrentVisit,
      currentVisitIsRetrospective: false,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });
  });

  test('displays a success snackbar when the visit is ended successfully', async () => {
    const user = userEvent.setup();

    mockUpdateVisit.mockResolvedValue({
      status: 200,
      data: {
        visitType: {
          display: 'Facility Visit',
        },
      },
    } as unknown as FetchResponse<Visit>);

    render(<EndVisitDialog patientUuid="some-patient-uuid" closeModal={mockCloseModal} />);

    // ModalHeader renders a close button with aria-label "Close" (exact); "Close Visit" is a separate button
    const closeModalButton = screen.getByRole('button', { name: /^close$/i });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const closeVisitButton = screen.getByRole('button', { name: /close visit/i });

    expect(closeModalButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(closeVisitButton).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /are you sure you want to end this active visit?/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/you can add additional encounters to this visit in the visit summary/i),
    ).toBeInTheDocument();

    await user.click(closeVisitButton);

    expect(updateVisit).toHaveBeenCalledWith(mockCurrentVisit.uuid, endVisitPayload, expect.anything());

    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      subtitle: 'Facility Visit ended successfully',
      kind: 'success',
      title: 'Visit ended',
    });
  });

  test('displays an error snackbar if there was a problem ending a visit', async () => {
    const user = userEvent.setup();

    const error = {
      message: 'Internal error message',
      response: {
        status: 500,
        statusText: 'Internal server error',
      },
    };

    mockUpdateVisit.mockRejectedValue(error);

    render(<EndVisitDialog patientUuid="some-patient-uuid" closeModal={mockCloseModal} />);

    expect(
      screen.getByText(/you can add additional encounters to this visit in the visit summary/i),
    ).toBeInTheDocument();

    const closeVisitButton = screen.getByRole('button', { name: /close visit/i });
    expect(closeVisitButton).toBeInTheDocument();

    await user.click(closeVisitButton);

    expect(updateVisit).toHaveBeenCalledWith(mockCurrentVisit.uuid, endVisitPayload, expect.anything());
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      subtitle: 'Internal error message',
      kind: 'error',
      title: 'Error ending visit',
      isLowContrast: false,
    });
  });
});
