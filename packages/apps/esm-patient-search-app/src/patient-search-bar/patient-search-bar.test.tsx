import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PatientSearchBar from './patient-search-bar.component';

describe('PatientSearchBar', () => {
  it('renders a search input', () => {
    render(<PatientSearchBar onClear={vi.fn()} onSubmit={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText('Search for a patient by name or identifier number');

    expect(searchInput).toBeInTheDocument();
  });

  it('displays the initial search term', () => {
    const initialSearchTerm = 'John Doe';
    render(<PatientSearchBar initialSearchTerm={initialSearchTerm} onClear={vi.fn()} onSubmit={vi.fn()} />);

    const searchInput: HTMLInputElement = screen.getByPlaceholderText(
      'Search for a patient by name or identifier number',
    );

    expect(searchInput.value).toBe(initialSearchTerm);
  });

  it('calls the onChange callback on input change', async () => {
    const user = userEvent.setup();
    const onChangeMock = vi.fn();

    render(<PatientSearchBar onChange={onChangeMock} onClear={vi.fn()} onSubmit={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText('Search for a patient by name or identifier number');

    await user.type(searchInput, 'New Value');

    expect(onChangeMock).toHaveBeenCalledWith('New Value');
  });

  it('calls the onClear callback on clear button click', async () => {
    const user = userEvent.setup();
    const onClearMock = vi.fn();

    render(<PatientSearchBar initialSearchTerm="Juan" onClear={onClearMock} onSubmit={vi.fn()} />);

    const clearButton = screen.getByRole('button', { name: 'Clear' });

    await user.click(clearButton);

    expect(onClearMock).toHaveBeenCalled();
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('calls the onSubmit callback on form submission', async () => {
    const user = userEvent.setup();
    const onSubmitMock = vi.fn();

    render(<PatientSearchBar onSubmit={onSubmitMock} onClear={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText('Search for a patient by name or identifier number');
    const searchButton = screen.getByRole('button', { name: 'Search' });

    await user.type(searchInput, 'Search Term');
    await user.click(searchButton);

    expect(onSubmitMock).toHaveBeenCalledWith('Search Term');
  });

  it('requires three characters and limits the query to one hundred characters', async () => {
    const user = userEvent.setup();
    const onSubmitMock = vi.fn();
    render(<PatientSearchBar onSubmit={onSubmitMock} onClear={vi.fn()} />);
    const searchInput = screen.getByRole('searchbox');
    const searchButton = screen.getByRole('button', { name: 'Search' });

    expect(searchInput).toHaveAttribute('maxlength', '100');
    await user.type(searchInput, 'Jo');
    expect(searchButton).toBeDisabled();

    await user.type(searchInput, 'h');
    expect(searchButton).toBeEnabled();

    await user.clear(searchInput);
    await user.type(searchInput, 'a'.repeat(101));
    expect(searchInput).toHaveValue('a'.repeat(100));
  });
});
