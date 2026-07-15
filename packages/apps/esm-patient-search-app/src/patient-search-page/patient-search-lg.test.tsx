import { logError, usePagination } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';

import PatientSearchComponent from './patient-search-lg.component';

const mockUsePagination = vi.mocked(usePagination);
const mockLogError = vi.mocked(logError);
const goTo = vi.fn();

const defaultProps = {
  fetchError: null,
  hasMore: false,
  isLoading: false,
  isValidating: false,
  query: 'Juan',
  searchResults: [],
};

describe('PatientSearchComponent', () => {
  beforeEach(() => {
    goTo.mockReset();
    mockLogError.mockClear();
    mockUsePagination.mockReturnValue({
      currentPage: 1,
      goTo,
      goToNext: vi.fn(),
      goToPrevious: vi.fn(),
      paginated: false,
      results: [],
      showNextButton: false,
      showPreviousButton: false,
      totalPages: 1,
    });
  });

  it.each([
    ['more server pages remain', { hasMore: true }],
    ['another page is validating', { isValidating: true }],
  ])('does not expose the empty or registration state while %s', (_description, state) => {
    render(<PatientSearchComponent {...defaultProps} {...state} />);

    expect(screen.getByText('Searching...')).toBeInTheDocument();
    expect(screen.queryByText(/no patient charts were found/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add patient/i })).not.toBeInTheDocument();
  });

  it('hides patient registration for an embedded selection flow after search completes', () => {
    render(<PatientSearchComponent {...defaultProps} showAddPatient={false} />);

    expect(screen.getByText(/no patient charts were found/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add patient/i })).not.toBeInTheDocument();
  });

  it('shows an error instead of an indefinite loading state when a later page fails', () => {
    const error = new Error('SQL timeout');
    render(<PatientSearchComponent {...defaultProps} fetchError={error} hasMore />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.queryByText('SQL timeout')).not.toBeInTheDocument();
    expect(screen.queryByText(/no patient charts were found/i)).not.toBeInTheDocument();
    expect(mockLogError).toHaveBeenCalledWith(error, 'Patient search request failed');
  });

  it('resets client pagination only when the query changes', async () => {
    const { rerender } = render(<PatientSearchComponent {...defaultProps} />);
    goTo.mockClear();

    rerender(<PatientSearchComponent {...defaultProps} query="Pedro" />);

    await waitFor(() => expect(goTo).toHaveBeenCalledWith(1));
    goTo.mockClear();

    rerender(<PatientSearchComponent {...defaultProps} query="Pedro" isValidating />);

    expect(goTo).not.toHaveBeenCalled();
  });

  it.each([
    ['the filtered result set has fewer pages', 1, 1],
    ['the pagination source temporarily reports zero pages', 0, 1],
  ])('clamps an obsolete current page when %s', async (_description, totalPages, expectedPage) => {
    mockUsePagination.mockReturnValue({
      currentPage: 3,
      goTo,
      goToNext: vi.fn(),
      goToPrevious: vi.fn(),
      paginated: false,
      results: [],
      showNextButton: false,
      showPreviousButton: true,
      totalPages,
    });

    render(<PatientSearchComponent {...defaultProps} searchResults={[{} as never]} />);

    expect(screen.getByText('Searching...')).toBeInTheDocument();
    expect(screen.queryByText(/no patient charts were found/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add patient/i })).not.toBeInTheDocument();
    await waitFor(() => expect(goTo).toHaveBeenCalledWith(expectedPage));
  });
});
