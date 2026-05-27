import {
  Button,
  DataTable,
  DataTableSkeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { Add, CheckmarkFilled, Time } from '@carbon/react/icons';
import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../config-schema';
import { useScreeningIndicators } from '../../../hooks/useScreeningIndicators';
import { formEntryWorkspace } from '../../../types';

import styles from './screening-indicators.scss';

interface ScreeningIndicatorsProps {
  patientUuid: string;
}

const ScreeningIndicators: React.FC<ScreeningIndicatorsProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { screenings, completedCount, totalRequired, isLoading, error } = useScreeningIndicators(patientUuid);
  const headerTitle = t('screeningIndicators', 'Tamizajes Obligatorios');

  const handleAdd = useCallback(() => {
    const formUuid = config.formsList.screeningIndicatorsForm;
    if (!formUuid) {
      console.warn('Form UUID not configured for screeningIndicatorsForm');
      return;
    }
    launchWorkspace2(formEntryWorkspace, {
      form: { uuid: formUuid },
      encounterUuid: '',
    });
  }, [config.formsList.screeningIndicatorsForm]);

  const tableHeaders = useMemo(
    () => [
      { key: 'status', header: '' },
      { key: 'name', header: t('name', 'Nombre') },
      { key: 'date', header: t('lastDate', 'Fecha') },
    ],
    [t],
  );

  const tableRows = useMemo(
    () =>
      screenings.map((screening, idx) => ({
        id: `screening-${idx}`,
        status: screening.completed ? (
          <CheckmarkFilled size={16} className={styles.iconSuccess} />
        ) : (
          <Time size={16} className={styles.iconPending} />
        ),
        name: t(screening.translationKey, screening.name),
        date: screening.date ?? '--',
      })),
    [screenings, t],
  );

  if (isLoading) {
    return <DataTableSkeleton size="sm" rowCount={4} columnCount={3} />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (screenings.length === 0) {
    return (
      <EmptyState displayText={t('noScreeningData', 'Sin datos de tamizaje registrados')} headerTitle={headerTitle} />
    );
  }

  return (
    <div className={styles.widgetCard}>
      <CardHeader title={headerTitle}>
        <Tag type={completedCount === totalRequired ? 'green' : 'gray'} size="sm">
          {completedCount}/{totalRequired}
        </Tag>
        <Button kind="ghost" size="sm" renderIcon={Add} onClick={handleAdd} iconDescription={t('add', 'Add')}>
          {t('add', 'Add')}
        </Button>
      </CardHeader>
      <DataTable headers={tableHeaders} rows={tableRows} size="sm" useZebraStyles>
        {({ rows, headers, getHeaderProps, getTableProps }) => (
          <TableContainer>
            <Table {...getTableProps()} aria-label={headerTitle}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const idx = parseInt(row.id.replace('screening-', ''), 10);
                  const isCompleted = screenings[idx]?.completed;
                  return (
                    <TableRow key={row.id} className={isCompleted ? styles.rowCompleted : styles.rowPending}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
};

export default ScreeningIndicators;
