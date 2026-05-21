import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockPastVisit, mockPatient, renderWithSwr } from 'test-utils';
import { usePastVisits } from './past-visit.resource';
import PastVisitSummary from './past-visit-details/past-visit-summary.component';

const mockUsePastVisits = vi.mocked(usePastVisits);

vi.mock('./past-visit.resource', () => ({
  usePastVisits: vi.fn(),
}));

describe('PastVisit', () => {
  it('renders an empty state when notes, encounters, medications, and vitals data is not available', async () => {
    const user = userEvent.setup();

    mockUsePastVisits.mockReturnValueOnce({
      visits: mockPastVisit.data.results[0],
      error: null,
      isLoading: false,
      isValidating: false,
    });

    renderWithSwr(<PastVisitSummary patientUuid={mockPatient.id} encounters={[]} />);

    expect(screen.queryAllByText(/vitals/i));
    const vitalsTab = screen.getByRole('tab', { name: /vitals/i });
    expect(vitalsTab).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /notes/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /medications/i })).toBeInTheDocument();
    await user.click(vitalsTab);
    expect(vitalsTab).toHaveAttribute('aria-selected', 'true');
  });
});
