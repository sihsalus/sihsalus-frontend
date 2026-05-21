import {
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableExpandedRow,
  TableExpandHeader,
  TableExpandRow,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import React from 'react';

import type { Observation } from '../../types';
import EncounterObservations from '../encounter-observation/encounter-observation.component';

import styles from './o-table.scss';

interface TableProps {
  tableHeaders: Array<{ key: string; header: React.ReactNode }>;
  tableRows: Array<Record<string, React.ReactNode | Array<Observation>> & { id: string; obs?: Array<Observation> }>;
  formConceptMap: Record<string, Record<string, unknown>>;
  isExpandable?: boolean;
}

function getHeaderContent(header: React.ReactNode): React.ReactNode {
  if (typeof header === 'object' && header !== null && 'content' in header) {
    return (header as { content?: React.ReactNode }).content ?? '';
  }

  return header;
}

export const OTable: React.FC<TableProps> = ({
  tableHeaders,
  tableRows,
  formConceptMap,
  isExpandable: _isExpandable,
}) => {
  return (
    <TableContainer>
      <DataTable rows={tableRows} headers={tableHeaders} isSortable={true} size="sm">
        {({ rows, headers, getHeaderProps, getTableProps, getRowProps }) => (
          <Table {...getTableProps()} aria-label="Encounter observations">
            <TableHead>
              <TableRow>
                <TableExpandHeader enableToggle={false} />
                {headers.map((header) => (
                  <TableHeader
                    key={header.key}
                    className={`${styles.productiveHeading01} ${styles.text02}`}
                    {...getHeaderProps({
                      header,
                      isSortable: header.isSortable,
                    })}
                  >
                    {getHeaderContent(header.header)}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, parentIndex) => (
                <React.Fragment key={parentIndex}>
                  <TableExpandRow {...getRowProps({ row })}>
                    {row.cells.map((cell, childIndex) => (
                      <TableCell key={childIndex}>{cell.value}</TableCell>
                    ))}
                  </TableExpandRow>
                  {row.isExpanded ? (
                    <TableExpandedRow className={styles.expandedRow} colSpan={headers.length + 1}>
                      <EncounterObservations
                        observations={tableRows?.[parentIndex]?.obs ?? []}
                        formConceptMap={formConceptMap}
                      />
                    </TableExpandedRow>
                  ) : (
                    <TableExpandedRow
                      className={styles.hiddenRow}
                      colSpan={headers.length + 2}
                      key={`${parentIndex}-hiddenRow`}
                    />
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTable>
    </TableContainer>
  );
};
