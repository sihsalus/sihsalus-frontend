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
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../config-schema';
import { usePartograph } from '../../hooks/usePartograph';
import { formEntryWorkspace } from '../../types';

import styles from './labour-delivery.scss';
import PartographChart from './partograph-chart';

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
  const tableRows =
    encounters.map((encounter) => {
      const groupMembers = encounter.groupMembers;
      const groupmembersObj = groupMembers.reduce((acc: Record<string, string | number | undefined>, curr) => {
        const value = curr.value;
        acc[curr.concept.uuid] = typeof value === 'string' || typeof value === 'number' ? value : value?.uuid;
        return acc;
      }, {});
      const timeRecorded = groupmembersObj[partographyConcepts.timeRecordedUuid];
      const descentOfHeadValue = groupmembersObj[partographyConcepts.descentOfHeadUuid]?.toString();
      return {
        id: `${encounter.uuid}`,
        date: formatDate(parseDate(encounter.obsDatetime.toString()), { mode: 'wide', time: true }),
        timeRecorded: timeRecorded ? dayjs(new Date(timeRecorded)).format('HH:mm') : '--',
        fetalHeartRate: groupmembersObj[partographyConcepts.fetalHeartRateUuid],
        cervicalDilation: groupmembersObj[partographyConcepts.cervicalDilationUuid],
        descentOfHead: descentOfHeadValue ? descentOfHeadAnswerLabels[descentOfHeadValue] : '--',
        contractionFrequency: groupmembersObj[partographyConcepts.contractionFrequencyUuid] ?? '--',
        contractionDuration: groupmembersObj[partographyConcepts.contractionDurationUuid] ?? '--',
      };
    }) ?? [];
  const chartData =
    encounters.map((encounter) => {
      const groupMembers = encounter.groupMembers;
      const groupmembersObj = groupMembers.reduce((acc: Record<string, string | number | undefined>, curr) => {
        const value = curr.value;
        acc[curr.concept.uuid] = typeof value === 'string' || typeof value === 'number' ? value : value?.uuid;
        return acc;
      }, {});
      const descentOfHeadValue = groupmembersObj[partographyConcepts.descentOfHeadUuid]?.toString();
      return {
        id: `${encounter.uuid}`,
        date: formatDate(parseDate(encounter.obsDatetime.toString()), { mode: 'wide', time: true }),
        fetalHeartRate: groupmembersObj[partographyConcepts.fetalHeartRateUuid],
        cervicalDilation: groupmembersObj[partographyConcepts.cervicalDilationUuid],
        descentOfHead: descentOfHeadValue ? descentOfHeadAnswerLabels[descentOfHeadValue] : undefined,
        contractionFrequency: groupmembersObj[partographyConcepts.contractionFrequencyUuid],
        contractionDuration: groupmembersObj[partographyConcepts.contractionDurationUuid],
      };
    }) ?? [];
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

  if (encounters?.length === 0) {
    return (
      <Layer>
        <Tile className={styles.tile}>
          <div className={!isDesktop(layout) ? styles.tabletHeading : styles.desktopHeading}>
            <h4>{headerTitle}</h4>
          </div>
          <EmptyDataIllustration />
          <p className={styles.content}>There is no partograph data to display for this patient.</p>
          <Button onClick={handleAddHistory} renderIcon={Add} kind="ghost">
            {t('recordLabourDetails', 'Record labour details')}
          </Button>
        </Tile>
      </Layer>
    );
  }
  return (
    <>
      {(() => {
        if (encounters && encounters?.length) {
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
                    iconDescription="Add vitals"
                  >
                    {t('add', 'Add')}
                  </Button>
                </div>
              </CardHeader>
              {chartView ? (
                <PartographChart partograpyComponents={chartData} />
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
