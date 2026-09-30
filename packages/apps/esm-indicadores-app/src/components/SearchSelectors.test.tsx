import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  DiagnosticoOption,
  EncounterTypeOption,
  LocationOption,
  OrdenOption,
} from '../api/types';
import {
  useDiagnosticoSearch,
  useEncounterTypeSearch,
  useLocationSearch,
  useOrdenSearch,
} from '../features/indicadores/hooks';
import DiagnosticoSearchSelector from './DiagnosticoSearchSelector';
import EncounterTypeSearchSelector from './EncounterTypeSearchSelector';
import LocationSearchSelector from './LocationSearchSelector';
import OrdenSearchSelector from './OrdenSearchSelector';

vi.mock('../features/indicadores/hooks', () => ({
  useLocationSearch: vi.fn(),
  useDiagnosticoSearch: vi.fn(),
  useOrdenSearch: vi.fn(),
  useEncounterTypeSearch: vi.fn(),
}));

const mockedUseLocationSearch = vi.mocked(useLocationSearch);
const mockedUseDiagnosticoSearch = vi.mocked(useDiagnosticoSearch);
const mockedUseOrdenSearch = vi.mocked(useOrdenSearch);
const mockedUseEncounterTypeSearch = vi.mocked(useEncounterTypeSearch);

function typeQuery(placeholder: string, value: string) {
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } });
}

describe('LocationSearchSelector', () => {
  const locations: Array<LocationOption> = [
    { uuid: 'loc-materno', display: 'Centro Obstétrico' },
    { uuid: 'loc-consulta', display: 'Consulta Externa' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseLocationSearch.mockReturnValue({ data: locations, error: undefined, isLoading: false });
  });

  it('forwards add/remove through onChange and binds locations contract labels', () => {
    const onChange = vi.fn();
    render(<LocationSearchSelector selectedItems={[]} onChange={onChange} />);

    typeQuery('Buscar servicios', 'materno');

    const listbox = screen.getByRole('listbox', { name: 'Servicios' });
    fireEvent.click(within(listbox).getByRole('button', { name: 'Agregar' }));
    expect(onChange).toHaveBeenCalledWith([locations[0]]);

    const selected = [locations[0], locations[1]];
    const { unmount } = render(<LocationSearchSelector selectedItems={selected} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Centro Obstétrico' }));
    expect(onChange).toHaveBeenLastCalledWith([locations[1]]);
    unmount();
  });
});

describe('DiagnosticoSearchSelector', () => {
  const diagnosticos: Array<DiagnosticoOption> = [
    { uuid: 'diag-anemia', codigo: 'D50.9', nombre: 'Anemia ferropénica' },
    { uuid: 'diag-gestante', codigo: 'Z34.9', nombre: 'Supervisión de embarazo' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseDiagnosticoSearch.mockReturnValue({ data: diagnosticos, error: undefined, isLoading: false });
  });

  it('renders codigo-prefixed labels and forwards selection', () => {
    const onChange = vi.fn();
    render(<DiagnosticoSearchSelector selectedItems={[]} onChange={onChange} />);

    typeQuery('Buscar diagnósticos', 'anemia');

    const listbox = screen.getByRole('listbox', { name: 'Diagnósticos' });
    expect(within(listbox).getByText('D50.9 · Anemia ferropénica')).toBeInTheDocument();
    fireEvent.click(within(listbox).getAllByRole('button', { name: 'Agregar' })[0]);
    expect(onChange).toHaveBeenCalledWith([diagnosticos[0]]);
  });
});

describe('OrdenSearchSelector', () => {
  const ordenes: Array<OrdenOption> = [
    { uuid: 'ord-hemograma', display: 'Hemograma' },
    { uuid: 'ord-ferritina', display: 'Ferritina sérica' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseOrdenSearch.mockReturnValue({ data: ordenes, error: undefined, isLoading: false });
  });

  it('binds the ordenes hook and forwards selection', () => {
    const onChange = vi.fn();
    render(<OrdenSearchSelector selectedItems={[]} onChange={onChange} />);

    typeQuery('Buscar órdenes o conceptos', 'hemo');

    const listbox = screen.getByRole('listbox', { name: 'Órdenes' });
    expect(within(listbox).getByText('Hemograma')).toBeInTheDocument();
    expect(mockedUseOrdenSearch).toHaveBeenCalled();
    fireEvent.click(within(listbox).getAllByRole('button', { name: 'Agregar' })[0]);
    expect(onChange).toHaveBeenCalledWith([ordenes[0]]);
  });
});

describe('EncounterTypeSearchSelector', () => {
  const encounterTypes: Array<EncounterTypeOption> = [
    { uuid: 'enc-cred-neonato', display: 'CRED Neonato' },
    { uuid: 'enc-control-prenatal', display: 'Control prenatal' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseEncounterTypeSearch.mockReturnValue({ data: encounterTypes, error: undefined, isLoading: false });
  });

  it('binds the encounter-type hook and forwards selection', () => {
    const onChange = vi.fn();
    render(<EncounterTypeSearchSelector selectedItems={[]} onChange={onChange} />);

    typeQuery('Buscar tipos de encuentro', 'cred');

    const listbox = screen.getByRole('listbox', { name: 'Tipos de encuentro' });
    expect(within(listbox).getByText('CRED Neonato')).toBeInTheDocument();
    fireEvent.click(within(listbox).getAllByRole('button', { name: 'Agregar' })[0]);
    expect(onChange).toHaveBeenCalledWith([encounterTypes[0]]);
  });
});
