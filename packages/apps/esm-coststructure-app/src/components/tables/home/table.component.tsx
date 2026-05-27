import type { DataTableHeader } from '@carbon/react';
import { DataTable, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { Edit, TrashCan } from '@carbon/react/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { CostStructure, Procedure } from '../../../types';

interface IRow {
  code: string;
  name: string;
  created_date: string;
  id: string;
  end_date: string;
  start_date: string;
}

interface CostStructureT extends CostStructure {
  procedure: Procedure;
}
interface HomeTableProps {
  data: CostStructureT[];
}
const HomeTable: React.FC<HomeTableProps> = ({ data }) => {
  const { t } = useTranslation();
  const headers: DataTableHeader[] = [
    { key: 'code', header: t('code', 'Código') },
    { key: 'name', header: t('procedureName', 'Nombre del procedimiento') },
    { key: 'created_date', header: t('createdDate', 'Fecha creada') },
    { key: 'start_date', header: t('startDate', 'Fecha Inicio') },
    { key: 'end_date', header: t('updatedDate', 'Fecha Actualizacion') },
    { key: 'actions', header: t('actions', 'Acciones') },
  ];
  const rows: IRow[] = data.map((cs, index) => ({
    id: cs.uuid ?? String(index),
    code: cs.procedure?.conceptId?.toString() ?? `PROC-${index + 1}`,
    name: cs.procedure?.name ?? t('noProcedure', 'Sin procedimiento'),
    created_date: cs.createdDate ? new Date(cs.createdDate).toLocaleDateString('es-PE') : '--',
    end_date: cs.endDate ? new Date(cs.endDate).toLocaleDateString('es-PE') : '--',
    start_date: cs.startDate ? new Date(cs.startDate).toLocaleDateString('es-PE') : '--',
  }));
  return (
    <>
      <DataTable rows={rows} headers={headers}>
        {({ getTableProps, getHeaderProps, getRowProps, getCellProps }) => (
          <Table {...getTableProps()} aria-label={t('costStructure', 'Estructura de costos')}>
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader key={header.key} {...getHeaderProps({ header })}>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <HomeTableRow key={row.id} row={row} getRowProps={getRowProps} getCellProps={getCellProps} />
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>
    </>
  );
};
interface HomeTableRowProps {
  row: IRow;
  getRowProps: (options: Record<string, unknown>) => Record<string, unknown>;
  getCellProps: (options: Record<string, unknown>) => Record<string, unknown>;
}
const HomeTableRow: React.FC<HomeTableRowProps> = ({ row, getRowProps, getCellProps }) => {
  return (
    <TableRow key={row.id} {...getRowProps({ row })}>
      <TableCell {...getCellProps({ cell: { id: `${row.id}-code` } })}>{row.code}</TableCell>
      <TableCell {...getCellProps({ cell: { id: `${row.id}-name` } })}>{row.name}</TableCell>
      <TableCell {...getCellProps({ cell: { id: `${row.id}-created` } })}>{row.created_date}</TableCell>
      <TableCell {...getCellProps({ cell: { id: `${row.id}-start` } })}>{row.start_date}</TableCell>
      <TableCell {...getCellProps({ cell: { id: `${row.id}-end` } })}>{row.end_date}</TableCell>
      <TableCell {...getCellProps({ cell: { id: `${row.id}-actions` } })}>
        <div>
          <Edit
            size={20}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              /* TODO: Implementar edición */
            }}
          />
          <TrashCan
            size={20}
            style={{ cursor: 'pointer' }}
            onClick={() => {
              /* TODO: Implementar eliminación */
            }}
          />
        </div>
      </TableCell>
    </TableRow>
  );
};
export default HomeTable;
