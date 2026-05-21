import * as XLSX from 'xlsx';
import type { FuaRequest } from '../hooks/useFuaRequests';

import { buildExportRows, exportFuasToExcel } from './fua-export';

// Mock xlsx so it doesn't write real files in tests
vi.mock('xlsx', () => ({
  __esModule: true,
  utils: {
    json_to_sheet: vi.fn(() => ({})),
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));

const mockFua: FuaRequest = {
  uuid: 'fua-uuid-1',
  id: 1,
  visitUuid: 'visit-uuid-1',
  name: 'FUA Consulta Externa',
  payload: '{}',
  fuaEstado: { uuid: 'estado-uuid-1', id: 2, nombre: 'En Proceso' },
  fechaCreacion: new Date('2024-01-15T10:00:00').getTime(),
  fechaActualizacion: new Date('2024-01-16T12:00:00').getTime(),
  numeroFua: 'FUA-2024-000001',
  observacionesSetiSis: undefined,
};

describe('buildExportRows', () => {
  it('maps FuaRequest fields to export row', () => {
    const rows = buildExportRows([mockFua]);
    expect(rows).toHaveLength(1);
    expect(rows[0]['N° FUA']).toBe('FUA-2024-000001');
    expect(rows[0]['Nombre']).toBe('FUA Consulta Externa');
    expect(rows[0]['Estado']).toBe('En Proceso');
    expect(rows[0]['UUID Visita']).toBe('visit-uuid-1');
    expect(rows[0]['Obs. SETI-SIS']).toBe('');
  });

  it('uses uuid as N° FUA when numeroFua is absent', () => {
    const fua = { ...mockFua, numeroFua: undefined };
    const rows = buildExportRows([fua]);
    expect(rows[0]['N° FUA']).toBe('fua-uuid-1');
  });

  it('includes SETI-SIS observation when present', () => {
    const fua = { ...mockFua, observacionesSetiSis: 'Diagnóstico no válido' };
    const rows = buildExportRows([fua]);
    expect(rows[0]['Obs. SETI-SIS']).toBe('Diagnóstico no válido');
  });

  it('handles empty array', () => {
    expect(buildExportRows([])).toEqual([]);
  });

  it('handles FUA without estado', () => {
    const fua = { ...mockFua, fuaEstado: null as any };
    const rows = buildExportRows([fua]);
    expect(rows[0]['Estado']).toBe('Sin estado');
  });
});

describe('exportFuasToExcel', () => {
  it('calls xlsx writeFile with default filename pattern', () => {
    exportFuasToExcel([mockFua]);
    expect(XLSX.utils.json_to_sheet).toHaveBeenCalled();
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalled();
    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^FUAs_\d{8}_\d{4}\.xlsx$/));
  });

  it('uses custom filename when provided', () => {
    exportFuasToExcel([mockFua], 'reporte.xlsx');
    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'reporte.xlsx');
  });
});
