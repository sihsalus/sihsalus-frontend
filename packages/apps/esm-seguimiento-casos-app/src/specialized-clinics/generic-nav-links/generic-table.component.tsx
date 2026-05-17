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
import type { Observation } from '../../types';
import EncounterObservations from './encounter-observations/encounter-observations.component';

interface GenericTableEncounter {
  uuid: string;
  encounterDatetime: string;
  visit?: { visitType?: { display?: string } };
  encounterProviders?: Array<{ provider: { display?: string; person?: { display?: string } } }>;
  obs?: Array<Observation>;
}

interface GenericTableRow {
  id: string;
  [key: string]: string;
}

type GenericTableProps = {
  encounters: GenericTableEncounter[];
  onEdit: (encounterUuid: string) => void;
  onDelete: (encounterUuid: string, encounterTypeName?: string) => void;
  headers: { key: string; header: string }[];
  rows?: GenericTableRow[];
};

const GenericTable: React.FC<GenericTableProps> = ({ encounters, onEdit, onDelete, headers, rows }) => {
  const { t } = useTranslation();
  function formatProviderName(display) {
    if (!display) {
      return '--';
    }
    return display.split('-')[0].trim();
  }
  const computedRows =
    rows ||
    encounters.map((encounter) => ({
      id: `${encounter.uuid}`,
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
          <Table {...getTableProps()} aria-label={t('caseEncounters', 'Case management encounters')}>
            <TableHead>
              <TableRow>
                <TableExpandHeader aria-label="expand row" />
                {headers.map((header, i) => (
                  <TableHeader key={i} {...getHeaderProps({ header })}>
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
                  <TableExpandedRow
                    colSpan={headers.length + 1}
                    className="demo-expanded-td"
                    {...getExpandedRowProps({ row })}
                  >
                    <>
                      <EncounterObservations observations={encounters[index]['obs'] ?? []} />
                      <Button onClick={() => onEdit(row.id)} kind="primary" size="sm">
                        Edit
                      </Button>
                      <Button onClick={() => onDelete(row.id)} kind="danger" size="sm">
                        Delete
                      </Button>
                    </>
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

export default GenericTable;
