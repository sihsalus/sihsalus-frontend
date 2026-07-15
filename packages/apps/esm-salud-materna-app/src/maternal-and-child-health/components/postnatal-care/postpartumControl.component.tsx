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
import { useLayoutType } from '@openmrs/esm-framework';
import { CardHeader, EmptyState } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import dayjs from 'dayjs';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import { postnatalCareEditPrivilege } from '../../../constants';
import { useMaternalFormLauncher } from '../../../hooks/useMaternalFormLauncher';
import { usePostpartumControlTable } from '../../../hooks/usePostpartumControl';

import styles from './postnatalCareChart.scss';

interface ProgramsDetailedSummaryProps {
  patientUuid: string;
}

interface RowData {
  id: string;
  rowHeader: string;
  [key: string]: string; // For dynamic column keys like atencion1, atencion2, etc.
}

const renderHeaderLabel = (header: React.ReactNode): React.ReactNode =>
  typeof header === 'object' && header !== null && 'content' in header
    ? (header as { content: React.ReactNode }).content
    : header;

const PostpartumControlTable: React.FC<ProgramsDetailedSummaryProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';
  const headerTitle = t('controlPuerperio', 'Control Puerperio');
  const { prenatalEncounters, isValidating, mutate } = usePostpartumControlTable(patientUuid);
  const { launchForm: launchPostpartumControlForm } = useMaternalFormLauncher('postpartumControl', headerTitle);

  const handleAddPrenatalAttention = () => {
    launchPostpartumControlForm('', () => void mutate());
  };

  // Define all possible row types based on the group members we've seen
  const allPossibleRows = useMemo(
    () => [
      { id: 'fecha', rowHeader: t('fechaYHoraAtencion', 'Fecha y hora atención'), prefix: 'encounterDatetime' },
      {
        id: 'temperature',
        rowHeader: t('EstadoAdministraciónVitaminaA', 'Estado de administración de vitamina A'),
        prefix: 'Estado de administración de vitamina A',
      },
      {
        id: 'PlanDeParto',
        rowHeader: t('Plan de Parto (Control/Visita/No se hizo/NA)', 'Plan de Parto (Control/Visita/No se hizo/NA)'),
        prefix: 'Frecuencia Cardíaca',
      },
      { id: 'Talla', rowHeader: t('Talla', 'Talla (cm)'), prefix: 'Talla (cm)' },
      { id: 'pesoCorporal', rowHeader: t('pesoCorporal', 'Peso Corporal (kg)'), prefix: 'Peso Corporal (kg)' },
      { id: 'Diagnóstico', rowHeader: t('Diagnóstico', 'Diagnóstico'), prefix: 'Diagnóstico' },
      {
        id: 'SignosYsíntomasPrincipales',
        rowHeader: t('SignosYsíntomasPrincipales', 'Signos y síntomas principales'),
        prefix: 'Signos y síntomas principales',
      },
      {
        id: 'examenFísicoTórax',
        rowHeader: t('examenFísicoTórax', 'Examen Físico de Tórax'),
        prefix: 'Examen Físico de Tórax',
      },
      {
        id: 'ExamenGenitalesExternos',
        rowHeader: t('ExamenGenitalesExternos', 'Examen Genitales Externos'),
        prefix: 'Examen Genitales Externos',
      },
      { id: 'Abdomen', rowHeader: t('Abdomen', 'Abdomen'), prefix: 'Abdomen' },
      { id: 'PielYMucosas', rowHeader: t('PielYMucosas', 'Piel y Mucosas'), prefix: 'Piel y Mucosas' },
      { id: 'EstadoGeneral', rowHeader: t('EstadoGeneral', 'Estado General'), prefix: 'Estado General' },
      { id: 'Anamnesis', rowHeader: t('Anamnesis', 'Anamnesis'), prefix: 'Anamnesis' },
      { id: 'proximaCita', rowHeader: t('proximaCita', 'Próxima cita'), prefix: 'Próxima cita' },
      { id: 'FirmaYSello', rowHeader: t('FirmaYSello', 'Firma y Sello'), prefix: 'Firma y Sello' },
    ],
    [t],
  );

  // Determine which rows to display based on the data we have
  const activeRows = useMemo(() => {
    if (!prenatalEncounters || prenatalEncounters.length === 0) {
      // If no data, return a subset of important rows
      return allPossibleRows.slice(0, 9);
    }
    // Track which row types we've seen in the data
    const seenPrefixes = new Set<string>();

    // Add the date row which is always present
    seenPrefixes.add('encounterDatetime');

    // Check all encounters and their observations
    prenatalEncounters.forEach((encounter) => {
      encounter.obs.forEach((obs) => {
        if (obs.groupMembers && obs.groupMembers.length > 0) {
          obs.groupMembers.forEach((member) => {
            // For each group member, check if it matches any of our row prefixes
            allPossibleRows.forEach((row) => {
              if (member.display.startsWith(row.prefix)) {
                seenPrefixes.add(row.prefix);
              }
            });
          });
        }
      });
    });

    // Return only the rows that have data
    return allPossibleRows.filter((row) => seenPrefixes.has(row.prefix));
  }, [prenatalEncounters, allPossibleRows]);

  // Determine the number of columns based on the number of encounters
  const maxEncounters = useMemo(() => {
    // Get the maximum encounter number or default to 9 if not found
    if (!prenatalEncounters || prenatalEncounters.length === 0) return 2;

    let maxNumber = 0;
    prenatalEncounters.forEach((encounter) => {
      encounter.obs.forEach((obs) => {
        if (obs.groupMembers) {
          obs.groupMembers.forEach((member) => {
            const match = member.display.match(/Número de atención puerperio: Atención puerperio (\d+)/);
            if (match) {
              const encounterNumber = Number.parseInt(match[1], 2);
              if (encounterNumber > maxNumber) {
                maxNumber = encounterNumber;
              }
            }
          });
        }
      });
    });

    // If we still haven't found a number, check the obs display
    if (maxNumber === 0) {
      prenatalEncounters.forEach((encounter) => {
        encounter.obs.forEach((obs) => {
          const match = obs.display.match(/Número de atención puerperio: Atención puerperio (\d+)/);
          if (match) {
            const encounterNumber = Number.parseInt(match[1], 2);
            if (encounterNumber > maxNumber) {
              maxNumber = encounterNumber;
            }
          }
        });
      });
    }

    // If we still haven't found a number, use the length of encounters
    if (maxNumber === 0) {
      maxNumber = prenatalEncounters.length;
    }

    // Return at least 9 columns or more if needed
    return Math.max(maxNumber + 1, 2);
  }, [prenatalEncounters]);

  // Generate table headers dynamically
  const tableHeaders = useMemo(() => {
    return [
      { key: 'rowHeader', header: t('AtencionesPuerperio', 'Atenciones Puerperio') },
      ...Array.from({ length: maxEncounters }, (_, i) => ({
        key: `atencion${i + 1}`,
        header: <div>{t(`atencion${i + 1}`, `Atención ${i + 1}`)}</div>,
      })),
    ];
  }, [t, maxEncounters]);

  // Generate table rows with data from encounters
  const tableRows = useMemo(() => {
    // Start with the active rows and initialize all cells with "--"
    const rowDataTemplate: RowData[] = activeRows.map((row) => ({
      id: row.id,
      rowHeader: row.rowHeader,
      ...Array.from({ length: maxEncounters }, (_, i) => ({ [`atencion${i + 1} `]: '--' })).reduce(
        (acc, curr) => ({ ...acc, ...curr }),
        {},
      ),
    }));

    // Helper function to extract value after colon
    const extractValue = (display: string): string => {
      const parts = display.split(': ');
      return parts.length > 1 ? parts[1] : display;
    };

    // Process each encounter
    if (prenatalEncounters && prenatalEncounters.length > 0) {
      prenatalEncounters.forEach((encounter, index) => {
        let encounterNumber: number | null = null;

        // Find the encounter number from group members
        encounter.obs.forEach((obs) => {
          if (obs.groupMembers) {
            obs.groupMembers.forEach((member) => {
              if (member.display.includes('Número de atención prenatal')) {
                const match = member.display.match(/Atención prenatal (\d+)/);
                if (match) {
                  encounterNumber = Number.parseInt(match[1], 10);
                }
              }
            });
          }
        });

        // If no encounter number found in group members, try the obs display
        if (!encounterNumber) {
          encounter.obs.forEach((obs) => {
            const match = obs.display.match(/Número de atención prenatal: Atención prenatal (\d+)/);
            if (match) {
              encounterNumber = Number.parseInt(match[1], 10);
            }
          });
        }

        // If still no encounter number, use the index+1
        if (!encounterNumber) {
          encounterNumber = index + 1;
        }

        // If encounter number is found and within range
        if (encounterNumber && encounterNumber <= maxEncounters) {
          // Set date and time
          const fechaRow = rowDataTemplate.find((row) => row.id === 'fecha');
          if (fechaRow) {
            fechaRow[`atencion${encounterNumber}`] = dayjs(encounter.encounterDatetime).format('DD/MM/YYYY HH:mm:ss');
          }

          // Process each observation and its group members
          encounter.obs.forEach((obs) => {
            if (obs.groupMembers && obs.groupMembers.length > 0) {
              // Process each group member
              obs.groupMembers.forEach((member) => {
                // Find which row this group member belongs to
                activeRows.forEach((row) => {
                  if (member.display.startsWith(row.prefix)) {
                    const tableRow = rowDataTemplate.find((r) => r.id === row.id);
                    if (tableRow) {
                      tableRow[`atencion${encounterNumber}`] = extractValue(member.display);
                    }
                  }
                });
              });
            }
          });
        }
      });
    }

    return rowDataTemplate;
  }, [prenatalEncounters, activeRows, maxEncounters]);

  return (
    <div>
      <div className={styles.widgetCard}>
        {prenatalEncounters?.length > 0 ? (
          <>
            <CardHeader title={headerTitle}>
              {isValidating && <InlineLoading />}
              <RequirePrivilege privilege={postnatalCareEditPrivilege} hideUnauthorized>
                <Button onClick={handleAddPrenatalAttention} kind="ghost">
                  {t('add', 'Add')}
                </Button>
              </RequirePrivilege>
            </CardHeader>
            <DataTable rows={tableRows} headers={tableHeaders} isSortable size={isTablet ? 'lg' : 'sm'} useZebraStyles>
              {({ rows, headers, getHeaderProps, getTableProps }) => (
                <TableContainer style={{ width: '100%' }}>
                  <Table aria-label="Tabla de cuidado prenatal" {...getTableProps()}>
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader
                            key={header.key}
                            className={classNames(styles.productiveHeading01, styles.text02)}
                            {...getHeaderProps({ header, isSortable: header.isSortable })}
                          >
                            {renderHeaderLabel(header.header)}
                          </TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>{cell.value?.content ?? cell.value}</TableCell>
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
          <RequirePrivilege
            privilege={postnatalCareEditPrivilege}
            fallback={<EmptyState headerTitle={headerTitle} displayText={t('controlPuerperio', 'Control Puerperio')} />}
          >
            <EmptyState
              headerTitle={headerTitle}
              displayText={t('controlPuerperio', 'Control Puerperio')}
              launchForm={handleAddPrenatalAttention}
            />
          </RequirePrivilege>
        )}
      </div>
    </div>
  );
};

export default PostpartumControlTable;
