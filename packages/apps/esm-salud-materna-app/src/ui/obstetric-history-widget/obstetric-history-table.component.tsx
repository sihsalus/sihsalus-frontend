// obstetric-history-table.component.tsx
import {
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ObstetricTableRowType } from './obstetric-history.schema';

interface ObstetricHistoryTableProps {
  tableRows: ObstetricTableRowType[];
  isLoading?: boolean;
}

const ObstetricHistoryTable: React.FC<ObstetricHistoryTableProps> = ({ tableRows, isLoading: _isLoading = false }) => {
  const { t } = useTranslation();
  const normalizedRows = tableRows.map((row, index) => ({
    id: row.id ?? `obstetric-row-${index}`,
    label: row.label ?? '',
    value: row.value ?? '--',
  }));

  const tableHeaders = [
    {
      key: 'label',
      header: t('field', 'Field'),
    },
    {
      key: 'value',
      header: t('value', 'Value'),
    },
  ];

  return (
    <>
      <DataTable rows={normalizedRows} headers={tableHeaders} size="sm" useZebraStyles>
        {({ rows, headers, getHeaderProps, getTableProps }) => (
          <TableContainer>
            <Table {...getTableProps()}>
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
                  <TableRow key={row.id}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    </>
  );
};

export default ObstetricHistoryTable;
