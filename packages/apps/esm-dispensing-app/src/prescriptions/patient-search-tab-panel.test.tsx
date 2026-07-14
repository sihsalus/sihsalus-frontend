import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PatientSearchTabPanel from './patient-search-tab-panel.component';

vi.mock('./prescriptions-table.component', () => ({
  default: ({ debouncedSearchTerm }: { debouncedSearchTerm: string }) => (
    <div data-testid="prescriptions-table">{debouncedSearchTerm}</div>
  ),
}));

describe('PatientSearchTabPanel', () => {
  it('requires a non-empty patient criterion', async () => {
    const user = userEvent.setup();
    render(<PatientSearchTabPanel />);

    const searchButton = screen.getByRole('button', { name: /^search$/i });
    expect(searchButton).toBeDisabled();

    await user.type(screen.getByRole('searchbox'), 'Ahuanari Flores');
    expect(searchButton).toBeEnabled();
  });

  it('trims the submitted name or document before searching', async () => {
    const user = userEvent.setup();
    render(<PatientSearchTabPanel />);

    await user.type(screen.getByRole('searchbox'), '  47852639  ');
    await user.click(screen.getByRole('button', { name: /^search$/i }));

    expect(screen.getByTestId('prescriptions-table')).toHaveTextContent('47852639');
  });

  it('clears both the input and the applied search', async () => {
    const user = userEvent.setup();
    render(<PatientSearchTabPanel />);

    await user.type(screen.getByRole('searchbox'), 'Maria Teresa');
    await user.click(screen.getByRole('button', { name: /^search$/i }));
    expect(screen.getByTestId('prescriptions-table')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^clear search input$/i }));

    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(screen.queryByTestId('prescriptions-table')).not.toBeInTheDocument();
  });
});
