import {
  Button,
  DataTable,
  DataTableSkeleton,
  Layer,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import { Add, ChartLineSmooth } from '@carbon/react/icons';
import { formatDate, isDesktop, launchWorkspace2, parseDate, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { CardHeader, EmptyDataIllustration, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import dayjs from 'dayjs';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../config-schema';
import { usePartograph } from '../../hooks/usePartograph';
import { formEntryWorkspace } from '../../types';

import styles from './labour-delivery.scss';
import PartographChart from './partograph-chart';
import { buildPartographRecords, type PartographProgressObservation } from './partograph-utils';

const renderHeaderLabel = (header: React.ReactNode): React.ReactNode =>
  typeof header === 'object' && header !== null && 'content' in header
    ? (header as { content: React.ReactNode }).content
    : header;

interface PartographyProps {
  patientUuid: string;
  filter?: (encounter: Record<string, unknown>) => boolean;
}

const Partograph: React.FC<PartographyProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { partography } = useConfig<ConfigObject>();
  const partographyConcepts = partography.concepts;
  const descentOfHeadAnswerLabels = partography.descentOfHeadAnswerLabels;
  const layout = useLayoutType();
  const [chartView, setChartView] = React.useState<boolean>(false);
  const { encounters = [], isLoading, isValidating, error } = usePartograph(patientUuid);
  const headerTitle = t('partograph', 'Partograph');
  const displayText = t('partographData', 'Vital Components');
  const headers = [
    {
      header: t('date', 'Date'),
      key: 'date',
    },
    {
      header: t('timeRecorded', 'Time Recorded'),
      key: 'timeRecorded',
    },
    {
      header: t('fetalHeartRate', 'Fetal heart rate'),
      key: 'fetalHeartRate',
    },
    {
      header: t('cervicalDilation', 'Cervical Dilation cm'),
      key: 'cervicalDilation',
    },
    {
      header: t('descentOfHead', 'Descent of Head'),
      key: 'descentOfHead',
    },
    {
      header: t('contractionFrequency', 'Contractions /10min'),
      key: 'contractionFrequency',
    },
    {
      header: t('contractionDuration', 'Duration (s)'),
      key: 'contractionDuration',
    },
  ];
  const partographRecords = useMemo(
    () =>
      buildPartographRecords(
        encounters as unknown as PartographProgressObservation[],
        partographyConcepts,
        descentOfHeadAnswerLabels,
      ),
    [descentOfHeadAnswerLabels, encounters, partographyConcepts],
  );

  const tableRows = useMemo(
    () =>
      partographRecords.map((record) => ({
        id: record.id,
        date: formatDate(parseDate(record.date), { mode: 'wide', time: true }),
        timeRecorded: record.timeRecorded ? dayjs(new Date(record.timeRecorded)).format('HH:mm') : '--',
        fetalHeartRate: record.fetalHeartRate ?? '--',
        cervicalDilation: record.cervicalDilation ?? '--',
        descentOfHead: record.descentOfHead ?? '--',
        contractionFrequency: record.contractionFrequency ?? '--',
        contractionDuration: record.contractionDuration ?? '--',
      })),
    [partographRecords],
  );
  const handleAddHistory = () => {
    launchWorkspace2(formEntryWorkspace, {
      form: { uuid: partography.formUuid },
      encounterUuid: '',
    });
  };

  if (isLoading) {
    return <DataTableSkeleton rowCount={5} />;
  }

  if (error) {
    return <ErrorState headerTitle={headerTitle} error={error} />;
  }

  if (partographRecords.length === 0) {
    return (
      <Layer>
        <Tile className={styles.tile}>
          <div className={!isDesktop(layout) ? styles.tabletHeading : styles.desktopHeading}>
            <h4>{headerTitle}</h4>
          </div>
          <EmptyDataIllustration />
          <p className={styles.content}>
            {t('noPartographData', 'No hay datos de partograma para mostrar en esta paciente.')}
          </p>
          <Button onClick={handleAddHistory} renderIcon={Add} kind="ghost">
            {t('recordLabourDetails', 'Registrar datos del trabajo de parto')}
          </Button>
        </Tile>
      </Layer>
    );
  }
  return (
    <>
      {(() => {
        if (partographRecords.length) {
          return (
            <div className={styles.widgetCard}>
              <CardHeader title={headerTitle}>
                <div className={styles.backgroundDataFetchingIndicator}>
                  <span>{isValidating ? isLoading : null}</span>
                </div>
                <div className={styles.vitalsHeaderActionItems}>
                  <div className={styles.toggleButtons}>
                    <Button
                      className={styles.tableViewToggle}
                      size="sm"
                      kind={chartView ? 'ghost' : 'tertiary'}
                      hasIconOnly
                      renderIcon={(props) => <Table {...props} size={16} />}
                      iconDescription={t('tableView', 'Table view')}
                      onClick={() => setChartView(false)}
                    />
                    <Button
                      className={styles.chartViewToggle}
                      size="sm"
                      kind={chartView ? 'tertiary' : 'ghost'}
                      hasIconOnly
                      renderIcon={(props) => <ChartLineSmooth {...props} size={16} />}
                      iconDescription={t('chartView', 'Chart view')}
                      onClick={() => setChartView(true)}
                    />
                  </div>
                  <span className={styles.divider}>|</span>

                  <Button
                    kind="ghost"
                    renderIcon={(props) => <Add {...props} size={16} />}
                    iconDescription={t('recordLabourDetails', 'Registrar datos del trabajo de parto')}
                    onClick={handleAddHistory}
                  >
                    {t('add', 'Agregar')}
                  </Button>
                </div>
              </CardHeader>
              {chartView ? (
                <PartographChart partographRecords={partographRecords} />
              ) : (
                <DataTable
                  useZebraStyles
                  headers={headers}
                  rows={tableRows}
                  size="sm"
                  render={({ rows, headers, getHeaderProps, getTableProps, getTableContainerProps }) => {
                    return (
                      <TableContainer {...getTableContainerProps()}>
                        <Table {...getTableProps()}>
                          <TableHead>
                            <TableRow>
                              {headers.map((header) => (
                                <TableHeader
                                  key={header.key}
                                  {...getHeaderProps({
                                    header,
                                    isSortable: header.isSortable,
                                  })}
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
                                  <TableCell key={cell.id}>{cell.value ?? '--'}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    );
                  }}
                />
              )}
            </div>
          );
        }
        return <EmptyState displayText={displayText} headerTitle={headerTitle} />;
      })()}
    </>
  );
};
export default Partograph;
