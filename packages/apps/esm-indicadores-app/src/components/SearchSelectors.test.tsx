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

    expect(screen.getByText('Servicios', { selector: 'p' })).toBeInTheDocument();
    typeQuery('Buscar servicios', 'materno');

    const results = screen.getByRole('list', { name: 'Servicios' });
    fireEvent.click(within(results).getAllByRole('button', { name: 'Agregar' })[0]);
    expect(onChange).toHaveBeenCalledWith([locations[0]]);

    const selected = [locations[0], locations[1]];
    const { unmount } = render(<LocationSearchSelector selectedItems={selected} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Centro Obstétrico' }));
    expect(onChange).toHaveBeenLastCalledWith([locations[1]]);
    unmount();
  });

  it('renders every match and leaves overflow to the scroll container', () => {
    const many: Array<LocationOption> = Array.from({ length: 25 }, (_, index) => ({
      uuid: `loc-${index + 1}`,
      display: `Servicio ${index + 1}`,
    }));
    mockedUseLocationSearch.mockReturnValue({ data: many, error: undefined, isLoading: false });

    render(<LocationSearchSelector selectedItems={[]} onChange={vi.fn()} />);
    typeQuery('Buscar servicios', 'servicio');

    const results = screen.getByRole('list', { name: 'Servicios' });
    expect(within(results).getAllByRole('listitem')).toHaveLength(25);
  });

  it('lists options on focus without typing', () => {
    render(<LocationSearchSelector selectedItems={[]} onChange={vi.fn()} />);

    fireEvent.focus(screen.getByPlaceholderText('Buscar servicios'));

    const results = screen.getByRole('list', { name: 'Servicios' });
    expect(within(results).getAllByRole('listitem')).toHaveLength(locations.length);
  });

  it('prompts to type when focused with no options and no query', () => {
    mockedUseLocationSearch.mockReturnValue({ data: [], error: undefined, isLoading: false });

    render(<LocationSearchSelector selectedItems={[]} onChange={vi.fn()} />);
    fireEvent.focus(screen.getByPlaceholderText('Buscar servicios'));

    expect(screen.getByText('Escriba para buscar opciones.')).toBeInTheDocument();
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

    expect(screen.getByText('Diagnósticos', { selector: 'p' })).toBeInTheDocument();
    typeQuery('Buscar diagnósticos', 'anemia');

    const results = screen.getByRole('list', { name: 'Diagnósticos' });
    expect(within(results).getByText('D50.9 · Anemia ferropénica')).toBeInTheDocument();
    fireEvent.click(within(results).getAllByRole('button', { name: 'Agregar' })[0]);
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

    expect(screen.getByText('Órdenes', { selector: 'p' })).toBeInTheDocument();
    typeQuery('Buscar órdenes o conceptos', 'hemo');

    const results = screen.getByRole('list', { name: 'Órdenes' });
    expect(within(results).getByText('Hemograma')).toBeInTheDocument();
    expect(mockedUseOrdenSearch).toHaveBeenCalled();
    fireEvent.click(within(results).getAllByRole('button', { name: 'Agregar' })[0]);
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

    expect(screen.getByText('Tipos de encuentro', { selector: 'p' })).toBeInTheDocument();
    typeQuery('Buscar tipos de encuentro', 'cred');

    const results = screen.getByRole('list', { name: 'Tipos de encuentro' });
    expect(within(results).getByText('CRED Neonato')).toBeInTheDocument();
    fireEvent.click(within(results).getAllByRole('button', { name: 'Agregar' })[0]);
    expect(onChange).toHaveBeenCalledWith([encounterTypes[0]]);
  });
});
