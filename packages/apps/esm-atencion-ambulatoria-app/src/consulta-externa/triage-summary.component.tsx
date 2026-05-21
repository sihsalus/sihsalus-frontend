import { Accordion, AccordionItem, Button, InlineLoading, Tag, Tile } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../config-schema';
import { type TriageVitals, useTriageVitals } from '../hooks/useTriageVitals';
import { patientFormEntryWorkspace } from '../utils/constants';
import styles from './consulta-externa-dashboard.scss';

interface TriageSummaryProps {
  patientUuid: string;
}

function getBmiCategory(bmi: number | null, t: (key: string, fallback: string) => string) {
  if (bmi === null) return { label: '--', tagType: 'warm-gray' as const };
  if (bmi < 18.5) return { label: t('underweight', 'Bajo peso'), tagType: 'cyan' as const };
  if (bmi < 25) return { label: t('normal', 'Normal'), tagType: 'green' as const };
  if (bmi < 30) return { label: t('overweight', 'Sobrepeso'), tagType: 'warm-gray' as const };
  return { label: t('obese', 'Obesidad'), tagType: 'red' as const };
}

function VitalRow({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className={styles.vitalRow}>
      <span className={styles.vitalLabel}>{label}</span>
      <span className={styles.vitalValue}>{value !== null ? `${value} ${unit}` : '--'}</span>
    </div>
  );
}

function TriageCard({ triage, t }: { triage: TriageVitals; t: (key: string, fallback: string) => string }) {
  const bmiCategory = getBmiCategory(triage.bmi, t);

  return (
    <div className={styles.triageCard}>
      <div className={styles.triageGrid}>
        <VitalRow label={t('weight', 'Peso')} value={triage.weight} unit="kg" />
        <VitalRow label={t('height', 'Talla')} value={triage.height} unit="cm" />
        <VitalRow
          label={t('bloodPressure', 'PA')}
          value={triage.systolicBp}
          unit={triage.diastolicBp !== null ? `/ ${triage.diastolicBp} mmHg` : 'mmHg'}
        />
        <VitalRow label={t('pulse', 'FC')} value={triage.pulse} unit="lpm" />
        <VitalRow label={t('respiratoryRate', 'FR')} value={triage.respiratoryRate} unit="rpm" />
        <VitalRow label={t('temperature', 'Temp')} value={triage.temperature} unit="°C" />
        <VitalRow label={t('oxygenSaturation', 'SpO2')} value={triage.oxygenSaturation} unit="%" />
        <div className={styles.vitalRow}>
          <span className={styles.vitalLabel}>{t('bmi', 'IMC')}</span>
          <span className={styles.vitalValue}>
            {triage.bmi !== null ? (
              <>
                {triage.bmi} kg/m²{' '}
                <Tag type={bmiCategory.tagType} size="sm">
                  {bmiCategory.label}
                </Tag>
              </>
            ) : (
              '--'
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

const TriageSummary: React.FC<TriageSummaryProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { triageEntries, latestTriage, isLoading } = useTriageVitals(
    patientUuid,
    config.encounterTypes?.triage,
    config.concepts as {
      weightUuid: string;
      heightUuid: string;
      systolicBloodPressureUuid: string;
      diastolicBloodPressureUuid: string;
      pulseUuid: string;
      respiratoryRateUuid: string;
      temperatureUuid: string;
      oxygenSaturationUuid: string;
    },
  );

  const handleLaunchForm = () => {
    launchPatientWorkspace(patientFormEntryWorkspace, {
      formInfo: {
        patientUuid,
        formUuid: config.vitals?.formUuid,
      },
    });
  };

  if (isLoading) {
    return <InlineLoading description={t('loading', 'Cargando...')} />;
  }

  return (
    <div className={styles.widgetContainer}>
      <div className={styles.tableHeader}>
        <span className={styles.tableHeaderTitle}>{t('triageSummary', 'Resumen de Triaje')}</span>
        <Button kind="ghost" size="sm" renderIcon={Add} onClick={handleLaunchForm}>
          {t('recordTriage', 'Registrar Triaje')}
        </Button>
      </div>

      {!latestTriage ? (
        <div className={styles.emptyState}>
          <p>{t('noTriageData', 'No hay datos de triaje registrados para este paciente.')}</p>
        </div>
      ) : (
        <>
          <Tile className={styles.latestTriageTile}>
            <div className={styles.latestTriageHeader}>
              <span>{t('latestTriage', 'Último Triaje')}</span>
              <Tag type="blue" size="sm">
                {formatDate(new Date(latestTriage.encounterDatetime))}
              </Tag>
              {latestTriage.provider && (
                <Tag type="outline" size="sm">
                  {latestTriage.provider}
                </Tag>
              )}
            </div>
            <TriageCard triage={latestTriage} t={t} />
          </Tile>

          {triageEntries.length > 1 && (
            <Accordion>
              {triageEntries.slice(1).map((triage) => (
                <AccordionItem
                  key={triage.encounterUuid}
                  title={
                    <span>
                      {formatDate(new Date(triage.encounterDatetime))}
                      {triage.provider && ` — ${triage.provider}`}
                    </span>
                  }
                >
                  <TriageCard triage={triage} t={t} />
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </>
      )}
    </div>
  );
};

export default TriageSummary;
