// obstetric-history-base.component.tsx
import { Button, ContentSwitcher, DataTableSkeleton, IconSwitch, InlineLoading } from '@carbon/react';
import { Analytics, Table } from '@carbon/react/icons';
import { AddIcon, useLayoutType } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequirePrivilege } from '@sihsalus/esm-rbac';

import { prenatalCareEditPrivilege } from '../../constants';
import { useMaternalFormLauncher } from '../../hooks/useMaternalFormLauncher';
import { usePrenatalAntecedents } from '../../hooks/usePrenatalAntecedents';

import styles from './obstetric-history-base.scss';
import ObstetricHistoryChart from './obstetric-history-chart.component';
import ObstetricHistoryTable from './obstetric-history-table.component';
import { obstetricHistoryFields } from '../../maternal-and-child-health/obstetric-history-fields';

interface ObstetricHistoryBaseProps {
  patientUuid: string;
}

const ObstetricHistoryBase: React.FC<ObstetricHistoryBaseProps> = ({ patientUuid }) => {
  const { t } = useTranslation('@sihsalus/esm-salud-materna-app');
  const displayText = t('obstetricHistory_lower', 'antecedentes obstétricos');
  const headerTitle = t('obstetricHistory', 'Antecedentes Obstétricos');
  const [chartView, setChartView] = useState(true);
  const isTablet = useLayoutType() === 'tablet';

  const { data: formattedObs, isLoading, error, isValidating, mutate } = usePrenatalAntecedents(patientUuid);
  const { launchForm: launchMaternalHistoryForm } = useMaternalFormLauncher(
    'maternalHistory',
    headerTitle,
    patientUuid,
  );

  const launchObstetricForm = useCallback(() => {
    launchMaternalHistoryForm('', () => void mutate());
  }, [launchMaternalHistoryForm, mutate]);

  const obstetricData = useMemo(() => {
    const record = formattedObs?.[0];
    if (!record) return null;
    const fields = obstetricHistoryFields;
    return {
      record,
      tableData: fields.map(({ key, labelKey }) => ({
        id: key,
        label: t(labelKey),
        value: record[key] ?? t('obstetricNotRecorded'),
      })),
    };
  }, [formattedObs, t]);

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" aria-label={t('loadingData')} />;
  }

  if (obstetricData) {
    return (
      <div className={styles.widgetCard}>
        <CardHeader title={headerTitle}>
          <div className={styles.backgroundDataFetchingIndicator}>
            <span>{isValidating ? <InlineLoading /> : null}</span>
          </div>
          <div className={styles.obstetricHeaderActionItems}>
            <ContentSwitcher
              selectedIndex={chartView ? 1 : 0}
              onChange={(evt) => setChartView(evt.name === 'chartView')}
              size={isTablet ? 'md' : 'sm'}
            >
              <IconSwitch name="tableView" text={t('tableView', 'Table view')}>
                <Table size={16} />
              </IconSwitch>
              <IconSwitch name="chartView" text={t('chartView', 'Chart view')}>
                <Analytics size={16} />
              </IconSwitch>
            </ContentSwitcher>
            <RequirePrivilege privilege={prenatalCareEditPrivilege} hideUnauthorized>
              <>
                <span className={styles.divider}>|</span>
                <Button
                  kind="ghost"
                  renderIcon={(props) => <AddIcon size={16} {...props} />}
                  iconDescription={t('addObstetricData', 'Agregar datos obstétricos')}
                  onClick={launchObstetricForm}
                >
                  {t('update', 'Actualizar')}
                </Button>
              </>
            </RequirePrivilege>
          </div>
        </CardHeader>

        {chartView ? (
          <ObstetricHistoryChart record={obstetricData.record} />
        ) : (
          <ObstetricHistoryTable tableRows={obstetricData.tableData} isLoading={isLoading} />
        )}
      </div>
    );
  }

  return (
    <RequirePrivilege
      privilege={prenatalCareEditPrivilege}
      fallback={<EmptyState displayText={displayText} headerTitle={headerTitle} />}
    >
      <EmptyState displayText={displayText} headerTitle={headerTitle} launchForm={launchObstetricForm} />
    </RequirePrivilege>
  );
};

export default ObstetricHistoryBase;
