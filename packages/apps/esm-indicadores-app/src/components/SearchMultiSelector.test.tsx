import { useDebounce } from '@openmrs/esm-framework';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SearchMultiSelector from './SearchMultiSelector';

// Identity debounce: every search term propagates synchronously to the
// onSearchChange callback. The component's own debounce timing is owned by
// @openmrs/esm-framework; here we want to drive the search-result surface
// deterministically.
vi.mock('@openmrs/esm-framework', () => ({
  useDebounce: vi.fn((value: string) => value),
  getUserFacingErrorMessage: vi.fn((_error, fallback) => fallback),
}));

interface SampleOption {
  uuid: string;
  display: string;
}

const options: Array<SampleOption> = [
  { uuid: 'loc-001', display: 'Centro Obstétrico' },
  { uuid: 'loc-002', display: 'Hospital Central' },
  { uuid: 'loc-003', display: 'Posta Rural' },
];

const props = (overrides: Partial<Parameters<typeof SearchMultiSelector>[0]> = {}) =>
  ({
    label: 'Servicios',
    placeholder: 'Buscar servicio...',
    emptyText: 'Ningún servicio seleccionado',
    noResultsText: 'Sin coincidencias',
    selectedItems: [] as Array<SampleOption>,
    data: options,
    isLoading: false,
    error: null as Error | null,
    itemKey: (item: SampleOption) => item.uuid,
    itemLabel: (item: SampleOption) => item.display,
    onChange: vi.fn(),
    onSearchChange: vi.fn(),
    ...overrides,
  }) as Parameters<typeof SearchMultiSelector>[0];

describe('SearchMultiSelector', () => {
  it('shows the empty state and no search results when the query is blank', () => {
    render(<SearchMultiSelector {...props()} />);

    expect(screen.getByText('Ningún servicio seleccionado')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('propagates the typed query through the debounced onSearchChange callback', () => {
    const onSearchChange = vi.fn();
    render(<SearchMultiSelector {...props({ onSearchChange })} />);

    const input = screen.getByPlaceholderText('Buscar servicio...');
    fireEvent.change(input, { target: { value: 'centro' } });

    expect(onSearchChange).toHaveBeenLastCalledWith('centro');
  });

  it('skips callbacks for empty / whitespace-only queries (normalizedQuery is blank)', () => {
    const onSearchChange = vi.fn();
    render(<SearchMultiSelector {...props({ onSearchChange })} />);

    const input = screen.getByPlaceholderText('Buscar servicio...');
    fireEvent.change(input, { target: { value: '   ' } });

    // First call is the initial mount with the empty normalized query.
    // No subsequent call with a whitespace-only value (it normalizes to '').
    expect(onSearchChange).toHaveBeenLastCalledWith('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders the matching options as a listbox, excluding already-selected items', () => {
    render(
      <SearchMultiSelector
        {...props({
          selectedItems: [{ uuid: 'loc-002', display: 'Hospital Central' }],
        })}
      />,
    );

    const input = screen.getByPlaceholderText('Buscar servicio...');
    fireEvent.change(input, { target: { value: 'o' } });

    const listbox = screen.getByRole('listbox');
    // Selected item (loc-002) is filtered out of the results; the other two
    // that contain "o" remain.
    expect(within(listbox).getByText(/Centro Obstétrico/)).toBeInTheDocument();
    expect(within(listbox).getByText(/Posta Rural/)).toBeInTheDocument();
    expect(within(listbox).queryByText(/Hospital Central/)).not.toBeInTheDocument();
  });

  it('adds an item via the Agregar button, clears the search input, and calls onChange', () => {
    const onChange = vi.fn();
    render(<SearchMultiSelector {...props({ onChange })} />);

    fireEvent.change(screen.getByPlaceholderText('Buscar servicio...'), { target: { value: 'centro' } });

    const addButtons = screen.getAllByRole('button', { name: 'Agregar' });
    fireEvent.click(addButtons[0]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([{ uuid: 'loc-001', display: 'Centro Obstétrico' }]);
    // Search input is cleared after a successful add so the next search starts fresh.
    expect(screen.getByPlaceholderText('Buscar servicio...')).toHaveValue('');
  });

  it('removes a selected item via the pill button and calls onChange with the remaining items', () => {
    const onChange = vi.fn();
    render(
      <SearchMultiSelector
        {...props({
          onChange,
          selectedItems: [
            { uuid: 'loc-001', display: 'Centro Obstétrico' },
            { uuid: 'loc-003', display: 'Posta Rural' },
          ],
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Quitar Centro Obstétrico/ }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([{ uuid: 'loc-003', display: 'Posta Rural' }]);
  });

  it('shows an anchor aria-label interpolated with the item label on each pill remove button', () => {
    render(
      <SearchMultiSelector
        {...props({
          selectedItems: [{ uuid: 'loc-001', display: 'Centro Obstétrico' }],
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Quitar Centro Obstétrico' })).toBeInTheDocument();
  });

  it('shows the InlineLoading state while results are loading', () => {
    render(<SearchMultiSelector {...props({ isLoading: true })} />);

    fireEvent.change(screen.getByPlaceholderText('Buscar servicio...'), { target: { value: 'a' } });

    expect(screen.getByText(/Buscando/)).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders the error banner (fallback message) when the search errored', () => {
    const error = new Error('Network Error');
    render(<SearchMultiSelector {...props({ error })} />);

    fireEvent.change(screen.getByPlaceholderText('Buscar servicio...'), { target: { value: 'a' } });

    // getUserFacingErrorMessage is mocked to return its fallback argument.
    expect(screen.getByText('No se pudieron cargar las opciones.')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows the no-results tile when the query returned no matches', () => {
    render(<SearchMultiSelector {...props({ data: [] })} />);

    fireEvent.change(screen.getByPlaceholderText('Buscar servicio...'), { target: { value: 'zzz' } });

    expect(screen.getByText('Sin coincidencias')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders the helper text when provided (instead of the empty selection state)', () => {
    render(<SearchMultiSelector {...props({ helperText: 'Elegí al menos un servicio.' })} />);

    expect(screen.getByText('Elegí al menos un servicio.')).toBeInTheDocument();
  });
});

// Ensure the module-level useDebounce mock is exercised as identity so the
// search surface updates synchronously with the input. This is a guard so
// the test setup never accidentally falls back to a real debounce.
describe('SearchMultiSelector mock contract', () => {
  it('useDebounce mock returns its input synchronously', () => {
    expect(vi.mocked(useDebounce)('hola')).toBe('hola');
  });
});
