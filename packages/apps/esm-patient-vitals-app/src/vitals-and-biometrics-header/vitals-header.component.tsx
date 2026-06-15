import { Button, InlineLoading, Tag, Toggletip, ToggletipButton, ToggletipContent } from '@carbon/react';
import { ArrowRight, Information } from '@carbon/react/icons';
import { ConfigurableLink, formatDate, parseDate, useConfig, type Visit } from '@openmrs/esm-framework';
import { ErrorState, useVisitOrOfflineVisit } from '@openmrs/esm-patient-common-lib';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import isToday from 'dayjs/plugin/isToday';
import React, { useCallback, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

dayjs.extend(isToday);
dayjs.extend(duration);

import { interpretBloodPressure, shouldShowBmi, useVitalsAndBiometrics, useVitalsConceptMetadata } from '../common';
import { type ConfigObject } from '../config-schema';
import { launchVitalsAndBiometricsForm as launchForm } from '../utils';
import styles from './vitals-header.scss';
import VitalsHeaderItem from './vitals-header-item.component';

interface VitalsHeaderProps {
  patientUuid: string;

  /**
   * This is useful for extensions slots using the Vitals Header
   */
  hideLinks?: boolean;

  patient?: fhir.Patient;
  visitContext?: Visit;
  launchCustomVitalsForm?: () => void;
}

const VitalsHeader: React.FC<VitalsHeaderProps> = ({
  patientUuid,
  hideLinks = false,
  patient,
  visitContext,
  launchCustomVitalsForm,
}) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { data: conceptUnits, conceptMetadata, conceptRangeMap, error: conceptsError } = useVitalsConceptMetadata();
  const { data: vitals, isLoading, isValidating, error: vitalsError } = useVitalsAndBiometrics(patientUuid, 'both');
  const latestVitals = vitals?.[0];
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const toggleDetailsPanel = () => setShowDetailsPanel(!showDetailsPanel);
  const { currentVisit } = useVisitOrOfflineVisit(patientUuid);

  const launchVitalsAndBiometricsForm = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (launchCustomVitalsForm) {
        launchCustomVitalsForm();
        return;
      }
      launchForm(visitContext && !visitContext.stopDatetime ? visitContext : currentVisit, config);
    },
    [config, currentVisit, launchCustomVitalsForm, visitContext],
  );

  const showBmi = shouldShowBmi(patient, config.biometrics);

  if (isLoading) {
    return (
      <InlineLoading role="progressbar" className={styles.loading} description={`${t('loading', 'Loading')} ...`} />
    );
  }

  if (vitalsError || conceptsError) {
    return (
      <ErrorState
        error={(vitalsError ?? conceptsError) as Error}
        headerTitle={t('vitalsAndBiometrics', 'Vitals and biometrics')}
      />
    );
  }

  if (latestVitals && Object.keys(latestVitals).length && conceptMetadata?.length) {
    const isActiveVisit = visitContext ? !visitContext.stopDatetime : Boolean(currentVisit?.uuid);

    const vitalsOverdueThresholdHours = config.vitals.vitalsOverdueThresholdHours ?? 12;
    const vitalsTakenTimeAgo = dayjs.duration(dayjs().diff(latestVitals?.date));
    const areVitalsOverdue = isActiveVisit && vitalsTakenTimeAgo.asHours() >= vitalsOverdueThresholdHours;

    const now = dayjs();
    const vitalsOverdueDayCount = Math.round(dayjs.duration(now.diff(latestVitals?.date)).asDays());
    const hoursSinceVitalsTaken = Math.round(vitalsTakenTimeAgo.asHours());

    let overdueVitalsTagContent: React.ReactNode;
    if (vitalsOverdueDayCount < 1) {
      const hoursLabel = hoursSinceVitalsTaken === 1 ? 'hour old' : 'hours old';
      overdueVitalsTagContent = (
        <Trans
          i18nKey={hoursSinceVitalsTaken === 1 ? 'hoursOldVitals_one' : 'hoursOldVitals_other'}
          count={hoursSinceVitalsTaken}
        >
          <span>
            These vitals are{' '}
            <strong>
              {hoursSinceVitalsTaken} {hoursLabel}
            </strong>
          </span>
        </Trans>
      );
    } else if (vitalsOverdueDayCount >= 1 && vitalsOverdueDayCount < 7) {
      const daysLabel = vitalsOverdueDayCount === 1 ? 'day old' : 'days old';
      overdueVitalsTagContent = (
        <Trans
          i18nKey={vitalsOverdueDayCount === 1 ? 'daysOldVitals_one' : 'daysOldVitals_other'}
          count={vitalsOverdueDayCount}
        >
          <span>
            These vitals are{' '}
            <strong>
              {vitalsOverdueDayCount} {daysLabel}
            </strong>
          </span>
        </Trans>
      );
    } else if (vitalsOverdueDayCount >= 7 && vitalsOverdueDayCount <= 14) {
      overdueVitalsTagContent = (
        <Trans i18nKey="overOneWeekOldVitals">
          <span>
            These vitals are <strong>over one week old</strong>
          </span>
        </Trans>
      );
    } else {
      overdueVitalsTagContent = (
        <Trans i18nKey="outOfDateVitals">
          <span>
            These vitals are <strong>out of date</strong>
          </span>
        </Trans>
      );
    }

    return (
      <div className={styles.container}>
        <div
          className={styles.vitalsHeader}
          onClick={toggleDetailsPanel}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleDetailsPanel();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className={styles.headerItems}>
            <span className={styles.heading}>{t('vitalsAndBiometrics', 'Vitals and biometrics')}</span>
            <span className={styles.bodyText}>
              {formatDate(parseDate(latestVitals?.date), { day: true, time: true })}
            </span>
            {areVitalsOverdue ? (
              <Tag className={styles.tag} type="red">
                <span className={styles.overdueIndicator}>{overdueVitalsTagContent}</span>
              </Tag>
            ) : null}
            {!hideLinks && (
              <ConfigurableLink
                className={styles.link}
                to={`${globalThis.spaBase}/patient/${patientUuid}/chart/Vitals & Biometrics`}
              >
                {t('vitalsHistory', 'Vitals history')}
              </ConfigurableLink>
            )}
          </div>
          {isValidating ? (
            <div className={styles.backgroundDataFetchingIndicator}>
              <span>
                <InlineLoading />
              </span>
            </div>
          ) : null}
          {!hideLinks && (
            <div className={styles.buttonContainer}>
              {conceptRangeMap?.size > 0 && (
                <Toggletip>
                  <ToggletipButton label={t('viewNormalRanges', 'View normal ranges')}>
                    <Information />
                  </ToggletipButton>
                  <ToggletipContent>
                    <table>
                      <thead>
                        <tr>
                          <th>{t('vital', 'Vital')}</th>
                          <th>{t('normalRange', 'Normal range')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(conceptRangeMap.entries()).map(([uuid, metadata]) => (
                          <tr key={uuid}>
                            <td>{metadata.display}</td>
                            <td>
                              {metadata.lowNormal != null && metadata.hiNormal != null
                                ? `${metadata.lowNormal} – ${metadata.hiNormal} ${metadata.units ?? ''}`
                                : t('notAvailable', 'N/A')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ToggletipContent>
                </Toggletip>
              )}
              <Button
                className={styles.recordVitalsButton}
                data-openmrs-role="Record Vitals"
                kind="ghost"
                onClick={launchVitalsAndBiometricsForm}
                size="sm"
              >
                {t('recordVitals', 'Record vitals')}
                <ArrowRight size={16} className={styles.recordVitalsIconButton} />
              </Button>
            </div>
          )}
        </div>
        <div className={styles.rowContainer}>
          <div className={styles.row}>
            <VitalsHeaderItem
              interpretation={interpretBloodPressure(
                latestVitals?.systolic,
                latestVitals?.diastolic,
                config?.concepts,
                conceptMetadata,
                latestVitals?.systolicRenderInterpretation,
                latestVitals?.diastolicRenderInterpretation,
              )}
              unitName={t('bp', 'BP')}
              unitSymbol={(latestVitals?.systolic && conceptUnits.get(config.concepts.systolicBloodPressureUuid)) ?? ''}
              value={`${latestVitals?.systolic ?? '--'} / ${latestVitals?.diastolic ?? '--'}`}
            />
            <VitalsHeaderItem
              interpretation={latestVitals?.pulseRenderInterpretation}
              unitName={t('heartRate', 'Heart rate')}
              unitSymbol={(latestVitals?.pulse && conceptUnits.get(config.concepts.pulseUuid)) ?? ''}
              value={latestVitals?.pulse ?? '--'}
            />
            <VitalsHeaderItem
              interpretation={latestVitals?.respiratoryRateRenderInterpretation}
              unitName={t('respiratoryRate', 'R. rate')}
              unitSymbol={
                (latestVitals?.respiratoryRate && conceptUnits.get(config.concepts.respiratoryRateUuid)) ?? ''
              }
              value={latestVitals?.respiratoryRate ?? '--'}
            />
            <VitalsHeaderItem
              interpretation={latestVitals?.spo2RenderInterpretation}
              unitName={t('spo2', 'SpO2')}
              unitSymbol={(latestVitals?.spo2 && conceptUnits.get(config.concepts.oxygenSaturationUuid)) ?? ''}
              value={latestVitals?.spo2 ?? '--'}
            />
            <VitalsHeaderItem
              interpretation={latestVitals?.temperatureRenderInterpretation}
              unitName={t('temperatureAbbreviated', 'Temp')}
              unitSymbol={(latestVitals?.temperature && conceptUnits.get(config.concepts.temperatureUuid)) ?? ''}
              value={latestVitals?.temperature ?? '--'}
            />
            <VitalsHeaderItem
              unitName={t('weight', 'Weight')}
              unitSymbol={(latestVitals?.weight && conceptUnits.get(config.concepts.weightUuid)) ?? ''}
              value={latestVitals?.weight ?? '--'}
            />
            <VitalsHeaderItem
              unitName={t('height', 'Height')}
              unitSymbol={(latestVitals?.height && conceptUnits.get(config.concepts.heightUuid)) ?? ''}
              value={latestVitals?.height ?? '--'}
            />
            {showBmi && (
              <VitalsHeaderItem
                unitName={t('bmi', 'BMI')}
                unitSymbol={(latestVitals?.bmi && config.biometrics['bmiUnit']) ?? ''}
                value={latestVitals?.bmi ?? '--'}
              />
            )}
            {latestVitals?.muac && (
              <VitalsHeaderItem
                unitName={t('muac', 'MUAC')}
                unitSymbol={
                  (latestVitals?.muac && conceptUnits.get(config.concepts.midUpperArmCircumferenceUuid)) ?? ''
                }
                value={latestVitals?.muac ?? '--'}
              />
            )}
            {latestVitals?.abdominalCircumference && (
              <VitalsHeaderItem
                interpretation={latestVitals.abdominalCircumferenceRenderInterpretation}
                unitName={t('abdominalCircumference', 'Abdominal circumference')}
                unitSymbol={
                  conceptUnits.get(config.concepts.abdominalCircumferenceUuid) ??
                  config.biometrics.abdominalCircumferenceUnit
                }
                value={latestVitals.abdominalCircumference}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.emptyStateVitalsHeader}>
      <div className={styles.container}>
        <span className={styles.heading}>{t('vitalsAndBiometrics', 'Vitals and biometrics')}</span>
        <span className={styles.bodyText}>{t('noDataRecorded', 'No data has been recorded for this patient')}</span>
      </div>

      {!hideLinks && (
        <Button className={styles.recordVitalsButton} kind="ghost" onClick={launchVitalsAndBiometricsForm} size="sm">
          {t('recordVitals', 'Record vitals')}
          <ArrowRight size={16} className={styles.recordVitalsIconButton} />
        </Button>
      )}
    </div>
  );
};

export default VitalsHeader;
