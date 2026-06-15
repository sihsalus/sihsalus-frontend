import dayjs from 'dayjs';
import type { Workbook } from 'exceljs';

import type { FuaRequest } from '../hooks/useFuaRequests';

export interface FuaExportRow {
  'N° FUA': string;
  Nombre: string;
  Estado: string;
  'UUID Visita': string;
  'Obs. SETI-SIS': string;
  'Fecha Creación': string;
  'Fecha Actualización': string;
}

export function buildExportRows(fuaOrders: Array<FuaRequest>): Array<FuaExportRow> {
  return fuaOrders.map((req) => ({
    'N° FUA': req.numeroFua ?? req.uuid,
    Nombre: req.name ?? '',
    Estado: req.fuaEstado?.nombre ?? 'Sin estado',
    'UUID Visita': req.visitUuid ?? '',
    'Obs. SETI-SIS': req.observacionesSetiSis ?? '',
    'Fecha Creación': req.fechaCreacion ? dayjs(req.fechaCreacion).format('YYYY-MM-DD HH:mm') : '',
    'Fecha Actualización': req.fechaActualizacion ? dayjs(req.fechaActualizacion).format('YYYY-MM-DD HH:mm') : '',
  }));
}

const fuaExportColumns = [
  { header: 'N° FUA', key: 'N° FUA', width: 20 },
  { header: 'Nombre', key: 'Nombre', width: 40 },
  { header: 'Estado', key: 'Estado', width: 20 },
  { header: 'UUID Visita', key: 'UUID Visita', width: 38 },
  { header: 'Obs. SETI-SIS', key: 'Obs. SETI-SIS', width: 50 },
  { header: 'Fecha Creación', key: 'Fecha Creación', width: 18 },
  { header: 'Fecha Actualización', key: 'Fecha Actualización', width: 18 },
];

export async function exportFuasToExcel(fuaOrders: Array<FuaRequest>, filename?: string): Promise<void> {
  const rows = buildExportRows(fuaOrders);
  const exportFilename = filename ?? `FUAs_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`;
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('FUAs');

  worksheet.columns = fuaExportColumns;
  worksheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    worksheet.addRow(row);
  }

  await downloadWorkbook(workbook, exportFilename);
}

async function downloadWorkbook(workbook: Workbook, fileName: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  try {
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}
