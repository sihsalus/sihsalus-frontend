import {
  Button,
  DataTable,
  InlineLoading,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { Add } from '@carbon/react/icons';
import {
  CardHeader,
  EmptyState,
  launchPatientWorkspace,
  launchStartVisitPrompt,
  useVisitOrOfflineVisit,
} from '@openmrs/esm-patient-common-lib';
import dayjs from 'dayjs';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './care-summary-table.scss';

function collectPrefixesFromMember(
  member: { display: string },
  rowDefinitions: RowDefinition[],
  seenPrefixes: Set<string>,
): void {
  const matchingRow = rowDefinitions.find((row) => member.display.startsWith(row.prefix));
  if (matchingRow) seenPrefixes.add(matchingRow.prefix);
}

function collectPrefixesFromEncounter(
  encounter: Encounter,
  rowDefinitions: RowDefinition[],
  seenPrefixes: Set<string>,
): void {
  encounter.obs.forEach((obs) => {
    (obs.groupMembers || []).forEach((member) => {
      collectPrefixesFromMember(member, rowDefinitions, seenPrefixes);
    });
  });
}

function applyMemberToRow(
  member: { display: string },
  activeRows: RowDefinition[],
  base: Array<{ id: string; [key: string]: React.ReactNode }>,
  encounterNumber: number,
  extractValue: (d: string) => string,
): void {
  const matchingRow = activeRows.find((row) => member.display.startsWith(row.prefix));
  if (matchingRow) {
    const rowRef = base.find((r) => r.id === matchingRow.id);
    if (rowRef) {
      rowRef[`atencion${encounterNumber}`] = extractValue(member.display);
    }
  }
}

function applyObsToRows(
  obs: Encounter['obs'][number],
  activeRows: RowDefinition[],
  base: Array<{ id: string; [key: string]: React.ReactNode }>,
  encounterNumber: number,
  extractValue: (d: string) => string,
): void {
  (obs.groupMembers || []).forEach((member) => {
    applyMemberToRow(member, activeRows, base, encounterNumber, extractValue);
  });
}

function getTableHeaderContent(header: React.ReactNode): React.ReactNode {
  if (typeof header === 'object' && header !== null && 'content' in header) {
    return (header as { content?: React.ReactNode }).content ?? '';
  }

  return header;
}

function getTableCellContent(cellValue: React.ReactNode): React.ReactNode {
  if (cellValue && typeof cellValue === 'object' && 'content' in cellValue) {
    return (cellValue as { content?: React.ReactNode }).content ?? '';
  }
  return cellValue ?? '';
}

interface Encounter {
  encounterDatetime: string;
  obs: {
    display: string;
    groupMembers?: {
      display: string;
    }[];
  }[];
}

interface RowDefinition {
  id: string;
  rowHeader: string;
  prefix: string;
}

interface RowData {
  id: string;
  rowHeader: string;
  [key: string]: React.ReactNode;
}

interface CareSummaryTableProps {
  patientUuid: string;
  title: string;
  emptyStateText: string;
  formUuid: string;
  useEncountersHook: (uuid: string) => {
    prenatalEncounters: Encounter[];
    isValidating: boolean;
    mutate: () => void;
  };
  rowDefinitions: RowDefinition[];
  headerPrefix?: string;
  customHeaderTransform?: (index: number) => JSX.Element;
}

const CareSummaryTable: React.FC<CareSummaryTableProps> = ({
  patientUuid,
  title,
  emptyStateText,
  formUuid,
  useEncountersHook,
  rowDefinitions,
  customHeaderTransform,
}) => {
  const { t } = useTranslation();
  const { prenatalEncounters, isValidating, mutate } = useEncountersHook(patientUuid);
  const { currentVisit } = useVisitOrOfflineVisit(patientUuid);

  const launchForm = useCallback(() => {
    try {
      if (!currentVisit) {
        launchStartVisitPrompt();
      } else {
        if (formUuid) {
          launchPatientWorkspace('patient-form-entry-workspace', {
            workspaceTitle: title,
            mutateForm: mutate,
            formInfo: { formUuid, patientUuid, additionalProps: {} },
          });
        }
      }
      if (mutate) {
        setTimeout(() => mutate(), 1000);
      }
    } catch (err) {
      console.error('Failed to launch form:', err);
    }
  }, [patientUuid, currentVisit, formUuid, title, mutate]);

  const activeRows = useMemo(() => {
    if (!prenatalEncounters || prenatalEncounters.length === 0) {
      return rowDefinitions.slice(0, 5);
    }

    const seenPrefixes = new Set<string>();
    seenPrefixes.add('encounterDatetime');

    prenatalEncounters.forEach((encounter) => {
      collectPrefixesFromEncounter(encounter, rowDefinitions, seenPrefixes);
    });

    return rowDefinitions.filter((row) => seenPrefixes.has(row.prefix));
  }, [prenatalEncounters, rowDefinitions]);

  const maxEncounters = useMemo(() => {
    if (!prenatalEncounters || prenatalEncounters.length === 0) return 9;

    let max = 0;
    prenatalEncounters.forEach((encounter) => {
      encounter.obs.forEach((obs) => {
        const match = obs.display.match(/Atenci[oó]n (?:prenatal|puerperio) (\d+)/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > max) max = n;
        }
      });
    });

    return Math.max(max + 1, 9);
  }, [prenatalEncounters]);

  const tableHeaders = useMemo(() => {
    return [
      { key: 'rowHeader', header: t('Atenciones', 'Atenciones') },
      ...Array.from({ length: maxEncounters }, (_, i) => ({
        key: `atencion${i + 1}`,
        header: customHeaderTransform ? customHeaderTransform(i + 1) : t(`atencion${i + 1}`, `Atención ${i + 1}`),
      })),
    ];
  }, [t, maxEncounters, customHeaderTransform]);

  const tableRows = useMemo(() => {
    const base: RowData[] = activeRows.map((row) => ({
      id: row.id,
      rowHeader: row.rowHeader,
      ...Object.fromEntries(Array.from({ length: maxEncounters }, (_, i) => [`atencion${i + 1}`, '--'])),
    }));

    const extractValue = (d: string): string => d.split(': ').slice(1).join(': ') || d;

    prenatalEncounters.forEach((encounter, i) => {
      let encounterNumber = i + 1;

      encounter.obs.forEach((obs) => {
        const match = obs.display.match(/Atenci[oó]n (?:prenatal|puerperio) (\d+)/);
        if (match) {
          encounterNumber = parseInt(match[1], 10);
        }
      });

      const dateRow = base.find((r) => r.id === 'fecha');
      if (dateRow) {
        dateRow[`atencion${encounterNumber}`] = dayjs(encounter.encounterDatetime).format('DD/MM/YYYY HH:mm');
      }

      encounter.obs.forEach((obs) => {
        applyObsToRows(obs, activeRows, base, encounterNumber, extractValue);
      });
    });

    return base;
  }, [prenatalEncounters, activeRows, maxEncounters]);

  return (
    <div className={styles.widgetCard}>
      {prenatalEncounters.length > 0 ? (
        <>
          <CardHeader title={title}>
            {isValidating && <InlineLoading />}
            <Button kind="ghost" renderIcon={(props) => <Add size={16} {...props} />} onClick={launchForm}>
              {t('add', 'Añadir')}
            </Button>
          </CardHeader>
          <DataTable rows={tableRows} headers={tableHeaders} isSortable useZebraStyles size="sm">
            {({ rows, headers, getHeaderProps, getTableProps }) => (
              <TableContainer>
                <Table {...getTableProps()} aria-label={title}>
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHeader key={header.key} {...getHeaderProps({ header })}>
                          {getTableHeaderContent(header.header)}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{getTableCellContent(cell.value)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
        </>
      ) : (
        <EmptyState headerTitle={title} displayText={emptyStateText} launchForm={launchForm} />
      )}
    </div>
  );
};

export default CareSummaryTable;
