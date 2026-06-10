import {
  Button,
  ButtonSet,
  DatePicker,
  DatePickerInput,
  Form,
  InlineNotification,
  NumberInput,
  Select,
  SelectItem,
  Stack,
  Tag,
  TextArea,
} from '@carbon/react';
import { CheckmarkFilled, CircleDash, WarningAltFilled } from '@carbon/react/icons';
import {
  getPatientName,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  useConfig,
  useLayoutType,
  usePatient,
  useSession,
} from '@openmrs/esm-framework';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConfigObject } from '../../../config-schema';
import { credEarlyStimulationEditPrivilege } from '../../../constants';
import type { DefaultPatientWorkspaceProps } from '../../../types';
import styles from './test-peruano-form.scss';
import {
  calculateTestPeruanoResults,
  createEmptyTestPeruanoProfile,
  getNextTestPeruanoCellStatus,
  mapToTestPeruanoEncounterPayload,
  TEST_PERUANO_AGE_MONTHS,
  TEST_PERUANO_AREAS,
  type TestPeruanoCellStatus,
  type TestPeruanoClassification,
  type TestPeruanoFormData,
} from './test-peruano-form.utils';

function getAgeInMonths(birthDate?: string) {
  if (!birthDate) {
    return null;
  }

  const birth = new Date(birthDate);
  const today = new Date();
  const years = today.getFullYear() - birth.getFullYear();
  const months = today.getMonth() - birth.getMonth();
  const age = years * 12 + months - (today.getDate() < birth.getDate() ? 1 : 0);

  return Math.max(0, age);
}

function getClassificationTag(classification: TestPeruanoClassification) {
  switch (classification) {
    case 'normal':
      return 'green';
    case 'riesgo':
      return 'magenta';
    case 'retraso':
      return 'red';
    default:
      return 'gray';
  }
}

function getCellStatusIcon(status: TestPeruanoCellStatus) {
  if (status === 'achieved') {
    return <CheckmarkFilled size={14} />;
  }

  if (status === 'notAchieved') {
    return <WarningAltFilled size={14} />;
  }

  return <CircleDash size={14} />;
}

const TestPeruanoForm: React.FC<DefaultPatientWorkspaceProps> = ({ closeWorkspace, workspaceProps }) => {
  const patientUuid = workspaceProps?.patientUuid ?? '';
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const config = useConfig<ConfigObject>();
  const session = useSession();
  const patient = usePatient(patientUuid);
  const [profile, setProfile] = useState(createEmptyTestPeruanoProfile);
  const [childAgeMonths, setChildAgeMonths] = useState<number>(0);
  const [evaluationDate, setEvaluationDate] = useState(new Date().toISOString().split('T')[0]);
  const [culturalContext, setCulturalContext] = useState<TestPeruanoFormData['culturalContext']>('urbano');
  const [primaryLanguage, setPrimaryLanguage] = useState<TestPeruanoFormData['primaryLanguage']>('español');
  const [observations, setObservations] = useState('');
  const [culturalNotes, setCulturalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showErrorNotification, setShowErrorNotification] = useState(false);

  useEffect(() => {
    const calculatedAge = getAgeInMonths(patient?.patient?.birthDate);
    if (calculatedAge != null) {
      setChildAgeMonths(calculatedAge);
    }
  }, [patient?.patient?.birthDate]);

  const isAgeSupported = childAgeMonths >= 0 && childAgeMonths <= 30;
  const currentAgeColumn = TEST_PERUANO_AGE_MONTHS.reduce(
    (nearest, month) => (month <= childAgeMonths ? month : nearest),
    TEST_PERUANO_AGE_MONTHS[0],
  );
  const results = useMemo(() => calculateTestPeruanoResults(profile, childAgeMonths), [profile, childAgeMonths]);

  const updateCell = useCallback((areaId: (typeof TEST_PERUANO_AREAS)[number]['id'], month: number) => {
    setProfile((current) => ({
      ...current,
      [areaId]: {
        ...current[areaId],
        [month]: getNextTestPeruanoCellStatus(current[areaId][month]),
      },
    }));
  }, []);

  const resetProfile = useCallback(() => {
    setProfile(createEmptyTestPeruanoProfile());
  }, []);

  const saveTestPeruanoData = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setIsSubmitting(true);
      setShowErrorNotification(false);

      const locationUuid = session?.sessionLocation?.uuid;
      if (!locationUuid || !isAgeSupported) {
        showSnackbar({
          title: t('testPeruanoSaveError', 'No se pudo guardar el Test Peruano'),
          kind: 'error',
          isLowContrast: false,
          subtitle: !locationUuid
            ? t('noSessionLocation', 'No se pudo determinar la sede de sesión.')
            : t('tpUnsupportedAge', 'El Test Peruano aplica hasta los 30 meses.'),
        });
        setIsSubmitting(false);
        return;
      }

      const payload = mapToTestPeruanoEncounterPayload({
        config: config.testPeruano,
        data: {
          childAgeMonths,
          evaluationDate,
          culturalContext,
          primaryLanguage,
          observations,
          culturalNotes,
        },
        locationUuid,
        patientUuid,
        profile,
        results,
      });

      try {
        const response = await openmrsFetch(`${restBaseUrl}/encounter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });

        if (response.status === 201 || response.status === 200) {
          showSnackbar({
            isLowContrast: true,
            kind: 'success',
            title: t('testPeruanoSaved', 'Test Peruano guardado'),
            subtitle: t('testPeruanoDataAvailable', 'La evaluación está disponible en el registro del paciente'),
          });
          closeWorkspace({ discardUnsavedChanges: true });
        }
      } catch (error) {
        setShowErrorNotification(true);
        showSnackbar({
          title: t('testPeruanoSaveError', 'No se pudo guardar el Test Peruano'),
          kind: 'error',
          isLowContrast: false,
          subtitle: (error as Error)?.message ?? t('unexpectedError', 'Ocurrió un error inesperado.'),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      childAgeMonths,
      closeWorkspace,
      config.testPeruano,
      culturalContext,
      culturalNotes,
      evaluationDate,
      isAgeSupported,
      observations,
      patientUuid,
      primaryLanguage,
      profile,
      results,
      session?.sessionLocation?.uuid,
      t,
    ],
  );

  return (
    <RequirePrivilege privilege={credEarlyStimulationEditPrivilege}>
      <Form className={styles.form} onSubmit={saveTestPeruanoData}>
        <Stack gap={6}>
          <header className={styles.header}>
            <div>
              <h3>{t('testPeruanoTitle', 'Test Peruano de Desarrollo del Niño')}</h3>
              <p>{t('testPeruanoSubtitle', 'Perfil gráfico de hitos del desarrollo de 0 a 30 meses')}</p>
            </div>
            <Tag type={getClassificationTag(results.total.classification)} size="md">
              {t(`tpClassification_${results.total.classification}`, results.total.classification)}
            </Tag>
          </header>

          <section className={styles.patientPanel}>
            <div>
              <span className={styles.fieldLabel}>{t('patient', 'Paciente')}</span>
              <strong>{patient.patient ? getPatientName(patient.patient) : t('loading', 'Cargando...')}</strong>
            </div>
            <NumberInput
              allowEmpty={false}
              disableWheel
              hideSteppers
              id="child-age-months"
              invalid={!isAgeSupported}
              invalidText={t('tpUnsupportedAge', 'El Test Peruano aplica hasta los 30 meses.')}
              label={t('ageMonthsLabel', 'Edad en meses')}
              max={30}
              min={0}
              onChange={(_event, { value }) => setChildAgeMonths(Number(value) || 0)}
              value={childAgeMonths}
            />
            <DatePicker
              datePickerType="single"
              dateFormat="Y-m-d"
              onChange={(dates) => {
                if (dates[0]) {
                  setEvaluationDate(dates[0].toISOString().split('T')[0]);
                }
              }}
              value={evaluationDate}
            >
              <DatePickerInput
                id="evaluation-date"
                labelText={t('evaluationDate', 'Fecha de evaluación')}
                placeholder="yyyy-mm-dd"
              />
            </DatePicker>
            <Select
              id="cultural-context"
              labelText={t('culturalContext', 'Contexto')}
              onChange={(event) => setCulturalContext(event.target.value as TestPeruanoFormData['culturalContext'])}
              value={culturalContext}
            >
              <SelectItem value="urbano" text={t('urban', 'Urbano')} />
              <SelectItem value="rural" text={t('rural', 'Rural')} />
              <SelectItem value="urbano_marginal" text={t('urbanMarginal', 'Urbano marginal')} />
            </Select>
            <Select
              id="primary-language"
              labelText={t('primaryLanguage', 'Idioma')}
              onChange={(event) => setPrimaryLanguage(event.target.value as TestPeruanoFormData['primaryLanguage'])}
              value={primaryLanguage}
            >
              <SelectItem value="español" text={t('spanish', 'Español')} />
              <SelectItem value="quechua" text={t('quechua', 'Quechua')} />
              <SelectItem value="bilingue" text={t('bilingual', 'Bilingüe')} />
            </Select>
          </section>

          <section className={styles.summaryPanel}>
            <div className={styles.summaryMetric}>
              <span>{t('tpExpectedMilestones', 'Hitos esperados')}</span>
              <strong>{results.total.expected}</strong>
            </div>
            <div className={styles.summaryMetric}>
              <span>{t('tpAchievedMilestones', 'Logrados')}</span>
              <strong>{results.total.achieved}</strong>
            </div>
            <div className={styles.summaryMetric}>
              <span>{t('tpPendingMilestones', 'Sin evaluar')}</span>
              <strong>{results.total.pending}</strong>
            </div>
            <div className={styles.summaryMetric}>
              <span>{t('tpScorePercent', 'Avance')}</span>
              <strong>{results.total.scorePercent}%</strong>
            </div>
          </section>

          <section className={styles.profileSection}>
            <div className={styles.sectionHeader}>
              <div>
                <h4>{t('tpGraphicProfile', 'Perfil gráfico')}</h4>
                <p>{t('tpGraphicProfileHint', 'Marque cada cruce área/edad: logrado, no logrado o sin evaluar.')}</p>
              </div>
              <div className={styles.legend}>
                <span>
                  <CheckmarkFilled size={14} /> {t('achieved', 'Logrado')}
                </span>
                <span>
                  <WarningAltFilled size={14} /> {t('notAchieved', 'No logrado')}
                </span>
                <span>
                  <CircleDash size={14} /> {t('notEvaluated', 'Sin evaluar')}
                </span>
              </div>
            </div>

            <div className={styles.profileGrid} role="grid" aria-label={t('tpGraphicProfile', 'Perfil gráfico')}>
              <div className={styles.cornerCell}>{t('area', 'Área')}</div>
              {TEST_PERUANO_AGE_MONTHS.map((month) => (
                <div
                  key={month}
                  className={`${styles.monthHeader} ${month === currentAgeColumn ? styles.currentMonth : ''}`}
                >
                  {month}
                </div>
              ))}

              {TEST_PERUANO_AREAS.map((area) => (
                <React.Fragment key={area.id}>
                  <div className={styles.areaName}>{t(area.labelKey, area.labelDefault)}</div>
                  {TEST_PERUANO_AGE_MONTHS.map((month) => {
                    const status = profile[area.id][month];
                    const isExpected = month <= childAgeMonths;

                    return (
                      <button
                        aria-label={`${t(area.labelKey, area.labelDefault)} ${month} ${t(status, status)}`}
                        className={`${styles.profileCell} ${styles[status]} ${isExpected ? styles.expected : ''}`}
                        key={`${area.id}-${month}`}
                        onClick={() => updateCell(area.id, month)}
                        type="button"
                      >
                        {getCellStatusIcon(status)}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </section>

          <section className={styles.areaResults}>
            {TEST_PERUANO_AREAS.map((area) => {
              const areaResult = results.areas[area.id];

              return (
                <div className={styles.areaResult} key={area.id}>
                  <div className={styles.areaResultHeader}>
                    <strong>{t(area.labelKey, area.labelDefault)}</strong>
                    <Tag type={getClassificationTag(areaResult.classification)} size="sm">
                      {t(`tpClassification_${areaResult.classification}`, areaResult.classification)}
                    </Tag>
                  </div>
                  <div className={styles.progressTrack}>
                    <span style={{ width: `${areaResult.scorePercent}%` }} />
                  </div>
                  <small>
                    {areaResult.achieved}/{areaResult.expected} · {areaResult.scorePercent}%
                  </small>
                </div>
              );
            })}
          </section>

          <section className={styles.notesGrid}>
            <TextArea
              labelText={t('culturalNotes', 'Notas culturales y de contexto')}
              onChange={(event) => setCulturalNotes(event.target.value)}
              placeholder={t(
                'culturalNotesPlaceholder',
                'Factores familiares, lingüísticos o ambientales relevantes para interpretar el perfil...',
              )}
              rows={3}
              value={culturalNotes}
            />
            <TextArea
              labelText={t('generalObservations', 'Observaciones generales')}
              onChange={(event) => setObservations(event.target.value)}
              placeholder={t('observationsPlaceholder', 'Observaciones clínicas de la evaluación...')}
              rows={3}
              value={observations}
            />
          </section>

          <InlineNotification
            hideCloseButton
            kind={results.total.classification === 'normal' ? 'success' : 'warning'}
            lowContrast
            title={t('recommendation', 'Recomendación')}
            subtitle={t(results.total.recommendationKey, results.total.recommendationDefault)}
          />

          {showErrorNotification && (
            <InlineNotification
              kind="error"
              title={t('error', 'Error')}
              subtitle={t('testPeruanoSaveErrorRetry', 'Revise el formulario e intente nuevamente.')}
              onClose={() => setShowErrorNotification(false)}
            />
          )}

          <ButtonSet className={isTablet ? styles.tabletActions : styles.actions}>
            <Button kind="secondary" onClick={() => closeWorkspace()} disabled={isSubmitting}>
              {t('cancel', 'Cancelar')}
            </Button>
            <Button kind="tertiary" onClick={resetProfile} disabled={isSubmitting} type="button">
              {t('reset', 'Limpiar')}
            </Button>
            <Button kind="primary" type="submit" disabled={isSubmitting || !isAgeSupported}>
              {isSubmitting ? t('saving', 'Guardando...') : t('saveAndClose', 'Guardar y cerrar')}
            </Button>
          </ButtonSet>
        </Stack>
      </Form>
    </RequirePrivilege>
  );
};

export default TestPeruanoForm;
