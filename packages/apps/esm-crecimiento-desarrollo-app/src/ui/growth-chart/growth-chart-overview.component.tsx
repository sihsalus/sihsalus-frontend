import { Button, ContentSwitcher, DataTableSkeleton, IconSwitch, InlineNotification } from '@carbon/react';
import { Add, Analytics, ChartLineData } from '@carbon/react/icons';
import {
  isDesktop as isDesktopLayout,
  launchWorkspace2,
  useLayoutType,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { CardHeader, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { credNeonatalEditPrivilege } from '../../constants';
import { getSafePatientName } from '../../utils/utils';
import GrowthChart from './growth-chart.component';
import styles from './growth-chart-overview.scss';
import { useBiometrics } from './hooks/useBiometrics';

interface GrowthChartProps {
  patient: fhir.Patient;
  patientUuid: string;
}

const GrowthChartOverview: React.FC<GrowthChartProps> = ({ patient, patientUuid }) => {
  const { t } = useTranslation();
  const headerTitle = t('growthChart', 'Evaluación del Crecimiento y Desarrollo');
  const displayText = t('relatedData', 'datos de crecimiento y desarrollo');
  const formWorkspace = 'newborn-anthropometric-form';
  const session = useSession();
  const canEdit = userHasAccess(credNeonatalEditPrivilege, session?.user);

  // Estado para controlar el modo de visualización (percentiles vs z-scores)
  const [isPercentiles, setIsPercentiles] = useState(true);

  const layout = useLayoutType();
  const isDesktop = isDesktopLayout(layout);
  const isTablet = !isDesktop;

  const launchForm = useCallback(() => {
    launchWorkspace2(formWorkspace, { patientUuid });
  }, [patientUuid]);

  const patientName = getSafePatientName(patient);

  const gender = useMemo(() => {
    const raw = patient?.gender?.toUpperCase?.();
    return raw === 'FEMALE' || raw === 'MALE' ? raw.charAt(0) : null;
  }, [patient]);

  const dateOfBirth = useMemo(() => {
    const parsed = patient?.birthDate ? new Date(patient.birthDate) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }, [patient?.birthDate]);
  const { data, isLoading: isLoading, error } = useBiometrics(patientUuid);

  const handleViewChange = useCallback((evt: { name: string }) => {
    setIsPercentiles(evt.name === 'percentileView');
  }, []);

  if (isLoading && !data) {
    return <DataTableSkeleton aria-label={t('loadingData', 'Loading data...')} />;
  }

  if (error) {
    return <ErrorState error={error} headerTitle={headerTitle} />;
  }

  // Sin sexo M/F o sin fecha de nacimiento válida no hay curva de referencia OMS aplicable:
  // graficar con valores por defecto mostraría curvas clínicamente incorrectas.
  if (!gender || !dateOfBirth) {
    return (
      <InlineNotification
        kind="warning"
        lowContrast
        hideCloseButton
        title={headerTitle}
        subtitle={t(
          'growthChartMissingDemographics',
          'No se puede graficar: el paciente no tiene sexo (M/F) o fecha de nacimiento válida registrada.',
        )}
      />
    );
  }

  if (data?.length) {
    return (
      <div className={styles.widgetCard}>
        <CardHeader title={headerTitle}>
          <div className={styles.clinicalDataHeaderActionItems}>
            <ContentSwitcher
              onChange={handleViewChange}
              size={isTablet ? 'md' : 'sm'}
              aria-label={t('chartTypeSelector', 'Seleccionar tipo de gráfico')}
              selectedIndex={isPercentiles ? 0 : 1}
            >
              <IconSwitch name="percentileView" text={t('percentileView', 'Percentiles')}>
                <Analytics size={16} />
              </IconSwitch>
              <IconSwitch name="zScoreView" text={t('zScoreView', 'Z-Scores')}>
                <ChartLineData size={16} />
              </IconSwitch>
            </ContentSwitcher>
            <span className={styles.divider}>|</span>
            {canEdit && (
              <Button
                kind="ghost"
                renderIcon={Add}
                iconDescription={t('addData', 'Agregar datos')}
                onClick={launchForm}
              >
                {t('add', 'Agregar')}
              </Button>
            )}
          </div>
        </CardHeader>

        <GrowthChart
          measurementData={data}
          patientName={patientName}
          gender={gender}
          dateOfBirth={dateOfBirth}
          isPercentiles={isPercentiles} // Pasar el estado al componente GrowthChart
        />
      </div>
    );
  }

  return (
    <EmptyState displayText={displayText} headerTitle={headerTitle} launchForm={canEdit ? launchForm : undefined} />
  );
};

export default GrowthChartOverview;
