import {
  Button,
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
import { formatDate } from '@openmrs/esm-framework';
import capitalize from 'lodash-es/capitalize';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { Encounter } from '../types';
import EncounterObservations from './encounter-observations/encounter-observations.component';

interface PsychologyTableRow {
  id: string;
  [key: string]: string;
}

type PsychologyTableProps = {
  canEdit: boolean;
  encounters: Encounter[];
  onEdit: (encounterUuid: string) => void;
  onDelete: (encounterUuid: string, encounterTypeName?: string) => void;
  headers: { key: string; header: string }[];
  rows?: PsychologyTableRow[];
};

const PsychologyTable: React.FC<PsychologyTableProps> = ({ canEdit, encounters, onEdit, onDelete, headers, rows }) => {
  const { t } = useTranslation();

  function formatProviderName(display?: string) {
    return display ? display.split('-')[0].trim() : '--';
  }

  const computedRows =
    rows ||
    encounters.map((encounter) => ({
      id: encounter.uuid,
      encounterDatetime: formatDate(new Date(encounter.encounterDatetime)),
      visitType: encounter.visit?.visitType?.display ?? '--',
      provider:
        encounter.encounterProviders?.length > 0
          ? formatProviderName(
              capitalize(
                encounter.encounterProviders[0].provider.display ??
                  encounter.encounterProviders[0].provider.person?.display,
              ),
            )
          : '--',
    }));

  return (
    <DataTable size="sm" useZebraStyles rows={computedRows} headers={headers}>
      {({ rows, headers, getHeaderProps, getRowProps, getExpandedRowProps, getTableProps, getTableContainerProps }) => (
        <TableContainer {...getTableContainerProps()}>
          <Table {...getTableProps()} aria-label={t('psychologyEncounters', 'Psychology encounters')}>
            <TableHead>
              <TableRow>
                <TableExpandHeader aria-label={t('expandRow', 'Expand row')} />
                {headers.map((header) => (
                  <TableHeader key={header.key} {...getHeaderProps({ header })}>
                    {header.header}
                  </TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <React.Fragment key={row.id}>
                  <TableExpandRow {...getRowProps({ row })}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableExpandRow>
                  <TableExpandedRow colSpan={headers.length + 1} {...getExpandedRowProps({ row })}>
                    <EncounterObservations observations={encounters[index].obs ?? []} />
                    {canEdit ? (
                      <>
                        <Button onClick={() => onEdit(row.id)} kind="primary" size="sm">
                          {t('edit', 'Edit')}
                        </Button>
                        <Button onClick={() => onDelete(row.id)} kind="danger" size="sm">
                          {t('delete', 'Delete')}
                        </Button>
                      </>
                    ) : null}
                  </TableExpandedRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </DataTable>
  );
};

export default PsychologyTable;
