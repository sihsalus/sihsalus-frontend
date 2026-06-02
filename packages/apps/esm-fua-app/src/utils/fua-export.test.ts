import type { FuaRequest } from '../hooks/useFuaRequests';

import { buildExportRows, exportFuasToExcel } from './fua-export';

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
    const fua = { ...mockFua, fuaEstado: null };
    const rows = buildExportRows([fua]);
    expect(rows[0]['Estado']).toBe('Sin estado');
  });
});

describe('exportFuasToExcel', () => {
  const createObjectURL = vi.fn(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn();
  let downloadedFileName = '';

  beforeEach(() => {
    downloadedFileName = '';
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadedFileName = this.download;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('downloads an Excel file with the default filename pattern', async () => {
    await exportFuasToExcel([mockFua]);

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(downloadedFileName).toMatch(/^FUAs_\d{8}_\d{4}\.xlsx$/);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('uses custom filename when provided', async () => {
    await exportFuasToExcel([mockFua], 'reporte.xlsx');

    expect(downloadedFileName).toBe('reporte.xlsx');
  });
});
