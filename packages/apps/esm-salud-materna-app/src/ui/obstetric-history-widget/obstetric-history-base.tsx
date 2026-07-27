// obstetric-history-base.component.tsx
import { Button, ContentSwitcher, DataTableSkeleton, IconSwitch, InlineLoading } from '@carbon/react';
import { AddIcon, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RequirePrivilege } from '@sihsalus/esm-rbac';

import type { ConfigObject } from '../../config-schema';
import { prenatalCareEditPrivilege } from '../../constants';
import { useMaternalFormLauncher } from '../../hooks/useMaternalFormLauncher';
import { usePrenatalAntecedents, usePrenatalConceptMetadata } from '../../hooks/usePrenatalAntecedents';

import styles from './obstetric-history-base.scss';
import ObstetricHistoryChart from './obstetric-history-chart.component';
import ObstetricHistoryTable from './obstetric-history-table.component';

interface ObstetricHistoryBaseProps {
  patientUuid: string;
}

const ObstetricHistoryBase: React.FC<ObstetricHistoryBaseProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const displayText = t('obstetricHistory_lower', 'antecedentes obstétricos');
  const headerTitle = t('obstetricHistory', 'Antecedentes Obstétricos');
  const [chartView, setChartView] = useState(false);
  const isTablet = useLayoutType() === 'tablet';

  const config = useConfig<ConfigObject>();
  const { data: formattedObs, isLoading, error, isValidating, mutate } = usePrenatalAntecedents(patientUuid);
  const { data: conceptUnits } = usePrenatalConceptMetadata();
  const { launchForm: launchMaternalHistoryForm } = useMaternalFormLauncher(
    'maternalHistory',
    'Antecedentes obstétricos',
  );

  const launchObstetricForm = useCallback(() => {
    launchMaternalHistoryForm('', () => void mutate());
  }, [launchMaternalHistoryForm, mutate]);

  // Preparar datos para ambas vistas
  const obstetricData = useMemo(() => {
    if (!formattedObs?.length) return null;

    const lastAntecedent = formattedObs[0];

    return {
      // Datos para la tabla
      tableData: [
        {
          id: 'gravidez',
          label: t('gravidez', 'Gravidez'),
          value: lastAntecedent.gravidez || '--',
        },
        {
          id: 'partoAlTermino',
          label: t('partoAlTermino', 'Partos a término'),
          value: lastAntecedent.partoAlTermino || '--',
        },
        {
          id: 'partoPrematuro',
          label: t('partoPrematuro', 'Partos prematuros'),
          value: lastAntecedent.partoPrematuro || '--',
        },
        {
          id: 'partoAborto',
          label: t('partoAborto', 'Abortos'),
          value: lastAntecedent.partoAborto || '--',
        },
        {
          id: 'partoNacidoVivo',
          label: t('partoNacidoVivo', 'Nacidos vivos'),
          value: lastAntecedent.partoNacidoVivo || '--',
        },
      ],
      // Datos para el gráfico/widget
      chartData: {
        pregnancies: lastAntecedent.gravidez || 0,
        termBirths: lastAntecedent.partoAlTermino || 0,
        prematureBirths: lastAntecedent.partoPrematuro || 0,
        abortions: lastAntecedent.partoAborto || 0,
        liveBirths: lastAntecedent.partoNacidoVivo || 0,
        stillBirths: lastAntecedent.partoNacidoMuerto || 0,
      },
      // Datos históricos para tendencias
      historicalData: formattedObs,
    };
  }, [formattedObs, t]);

  if (isLoading) {
    return <DataTableSkeleton role="progressbar" />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  if (obstetricData) {
    return (
      <div className={styles.widgetCard}>
        <CardHeader title={headerTitle}>
          <div className={styles.backgroundDataFetchingIndicator}>
            <span>{isValidating ? <InlineLoading /> : null}</span>
          </div>
          <div className={styles.obstetricHeaderActionItems}>
            <ContentSwitcher onChange={(evt) => setChartView(evt.name === 'chartView')} size={isTablet ? 'md' : 'sm'}>
              <IconSwitch name="tableView" text={t('tableView', 'Table view')} />
              <IconSwitch name="chartView" text={t('chartView', 'Chart view')} />
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
          <ObstetricHistoryChart
            obstetricData={obstetricData.chartData}
            historicalData={obstetricData.historicalData}
            conceptUnits={conceptUnits}
            config={config}
          />
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
