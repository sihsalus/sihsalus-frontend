import { Button, InlineLoading, Tag, Tile } from '@carbon/react';
import { Launch } from '@carbon/react/icons';
import { launchWorkspace2, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import type { ConfigObject } from '../../config-schema';
import styles from './maternal-nts-compliance.scss';

type FormKey = keyof ConfigObject['formsList'];
type RequirementStatus = 'completed' | 'pending' | 'notConfigured';

type MaternalEncounter = {
  uuid: string;
  encounterDatetime?: string;
  form?: {
    uuid?: string;
    name?: string;
    display?: string;
  };
};

type EncounterResponse = {
  results: Array<MaternalEncounter>;
};

type Requirement = {
  id: string;
  section: string;
  label: string;
  description: string;
  source: string;
  formKey?: FormKey;
};

type RequirementViewModel = Requirement & {
  configuredForm?: string;
  status: RequirementStatus;
  completedDate?: string;
};

const maternalHealthFormsWorkspace = 'maternal-health-forms-selector-workspace';

const requirements: Array<Requirement> = [
  {
    id: 'maternal-history',
    section: 'Atención prenatal reenfocada',
    label: 'Historia y antecedentes obstétricos',
    description: 'Historia materno perinatal y factores de riesgo iniciales.',
    source: 'NTS 105',
    formKey: 'maternalHistory',
  },
  {
    id: 'current-pregnancy',
    section: 'Atención prenatal reenfocada',
    label: 'Embarazo actual',
    description: 'Datos de gestación actual, edad gestacional y evaluación clínica.',
    source: 'NTS 105',
    formKey: 'currentPregnancy',
  },
  {
    id: 'prenatal-care',
    section: 'Atención prenatal reenfocada',
    label: 'Control prenatal',
    description: 'Seguimiento clínico, signos de alarma, examen obstétrico y consejería.',
    source: 'NTS 105',
    formKey: 'atencionPrenatal',
  },
  {
    id: 'prenatal-screening',
    section: 'Atención prenatal reenfocada',
    label: 'Tamizajes prenatales',
    description: 'VIH, sífilis, hepatitis B, hemoglobina, orina y otros exámenes auxiliares configurados.',
    source: 'NTS 105 / NTS ITS-VIH-Hepatitis',
    formKey: 'screeningIndicatorsForm',
  },
  {
    id: 'prenatal-supplementation',
    section: 'Atención prenatal reenfocada',
    label: 'Suplementación gestante',
    description: 'Hierro, ácido fólico, calcio o suplementación definida por el establecimiento.',
    source: 'NTS 105',
    formKey: 'prenatalSupplementationForm',
  },
  {
    id: 'birth-plan',
    section: 'Atención prenatal reenfocada',
    label: 'Plan de parto',
    description: 'Planificación de parto, transporte, acompañante y establecimiento de referencia.',
    source: 'NTS 105',
    formKey: 'birthPlanForm',
  },
  {
    id: 'psychoprophylaxis',
    section: 'Atención prenatal reenfocada',
    label: 'Psicoprofilaxis obstétrica',
    description: 'Preparación para parto y estimulación prenatal.',
    source: 'RM 361-2011 / NTS 105',
    formKey: 'psychoprophylaxisForm',
  },
  {
    id: 'violence-screening',
    section: 'Atención integral diferenciada',
    label: 'Tamizaje de violencia',
    description: 'Identificación y registro de violencia contra la gestante.',
    source: 'NTS 105 / Ley 30364',
    formKey: 'maternalViolenceScreeningForm',
  },
  {
    id: 'mental-health',
    section: 'Atención integral diferenciada',
    label: 'Salud mental perinatal',
    description: 'Tamizaje y seguimiento de salud mental durante embarazo y puerperio.',
    source: 'NTS 105 / salud mental perinatal',
    formKey: 'perinatalMentalHealthForm',
  },
  {
    id: 'adolescent-pregnancy',
    section: 'Atención integral diferenciada',
    label: 'Gestante adolescente',
    description: 'Atención diferenciada, red de soporte, continuidad educativa y consejería SSR.',
    source: 'NTS 130',
    formKey: 'adolescentPregnancyCareForm',
  },
  {
    id: 'delivery',
    section: 'Parto institucional y calificado',
    label: 'Parto o aborto',
    description: 'Atención institucional del parto, aborto o evento obstétrico.',
    source: 'NTS 105',
    formKey: 'deliveryOrAbortion',
  },
  {
    id: 'partograph-summary',
    section: 'Parto institucional y calificado',
    label: 'Resumen parto-postparto',
    description: 'Resumen de labor, parto, puerperio y recién nacido inmediato.',
    source: 'NTS 105',
    formKey: 'SummaryOfLaborAndPostpartum',
  },
  {
    id: 'obstetrics-service',
    section: 'Parto institucional y calificado',
    label: 'Servicio de obstetricia',
    description: 'Registro complementario de atención obstétrica hospitalaria.',
    source: 'NTS 105',
    formKey: 'obstetricsServiceForm',
  },
  {
    id: 'immediate-postpartum',
    section: 'Puerperio',
    label: 'Puerperio inmediato',
    description: 'Vigilancia y manejo inmediato posterior al parto.',
    source: 'NTS 105',
    formKey: 'immediatePostpartumPeriod',
  },
  {
    id: 'postpartum-control',
    section: 'Puerperio',
    label: 'Control de puerperio',
    description: 'Seguimiento de la puérpera y signos de alarma postnatales.',
    source: 'NTS 105',
    formKey: 'postpartumControl',
  },
  {
    id: 'maternal-discharge',
    section: 'Puerperio',
    label: 'Egreso materno',
    description: 'Condición de egreso, indicaciones y continuidad del cuidado.',
    source: 'NTS 105',
    formKey: 'maternalDischargeForm',
  },
  {
    id: 'family-planning',
    section: 'Continuidad post evento obstétrico',
    label: 'Planificación familiar',
    description: 'Consejería y método anticonceptivo post evento obstétrico.',
    source: 'NTS 105 / planificación familiar',
    formKey: 'familyPlanningCounselingForm',
  },
  {
    id: 'cancer-prevention',
    section: 'Continuidad post evento obstétrico',
    label: 'Prevención de cáncer',
    description: 'Tamizaje cervical y de mama según edad, riesgo y oferta local.',
    source: 'NTS 105 / prevención oncológica',
    formKey: 'cervicalCancerScreeningForm',
  },
  {
    id: 'referral-counterreferral',
    section: 'Gestión clínica',
    label: 'Referencia / contrarreferencia obstétrica',
    description: 'Trazabilidad específica para riesgo obstétrico o emergencia materna.',
    source: 'NTS 105',
    formKey: 'obstetricReferralForm',
  },
  {
    id: 'cultural-adequacy',
    section: 'Gestión clínica',
    label: 'Pertinencia cultural y preferencia de parto',
    description: 'Preferencia de posición, acompañante, idioma y adecuación cultural del parto.',
    source: 'NTS 105 / parto vertical / RM 228-2019-MINSA',
    formKey: 'culturalBirthPreferencesForm',
  },
];

const statusMeta: Record<RequirementStatus, { labelKey: string; label: string; tagType: 'green' | 'red' | 'gray' }> = {
  completed: { labelKey: 'completed', label: 'Completo', tagType: 'green' },
  pending: { labelKey: 'pending', label: 'Pendiente', tagType: 'red' },
  notConfigured: { labelKey: 'notConfigured', label: 'Sin soporte', tagType: 'gray' },
};

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? '';

const formatDate = (date?: string) => {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
};

function useMaternalEncounters(patientUuid: string) {
  const representation = 'custom:(uuid,encounterDatetime,form:(uuid,name,display))';
  const url = patientUuid ? `${restBaseUrl}/encounter?patient=${patientUuid}&limit=100&v=${representation}` : null;

  return useSWR<EncounterResponse, Error>(url, async (url) => {
    const response = await openmrsFetch<EncounterResponse>(url);
    return response.data;
  });
}

const MaternalNtsCompliance: React.FC<{ patientUuid: string }> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { data, error, isLoading } = useMaternalEncounters(patientUuid);

  const translatedRequirements = useMemo<Array<Requirement>>(
    () =>
      requirements.map((requirement) => ({
        ...requirement,
        section: t(`${requirement.id}Section`, requirement.section),
        label: t(`${requirement.id}Label`, requirement.label),
        description: t(`${requirement.id}Description`, requirement.description),
        source: t(`${requirement.id}Source`, requirement.source),
      })),
    [t],
  );

  const completedForms = useMemo(() => {
    const forms = new Map<string, string>();

    for (const encounter of data?.results ?? []) {
      const completedDate = encounter.encounterDatetime;
      for (const value of [encounter.form?.uuid, encounter.form?.name, encounter.form?.display]) {
        const key = normalize(value);
        if (key && !forms.has(key)) {
          forms.set(key, completedDate ?? '');
        }
      }
    }

    return forms;
  }, [data?.results]);

  const requirementViewModels = useMemo<Array<RequirementViewModel>>(() => {
    return translatedRequirements.map((requirement) => {
      if (!requirement.formKey) {
        return { ...requirement, status: 'notConfigured' };
      }

      const configuredForm = config.formsList[requirement.formKey];
      if (!configuredForm) {
        return { ...requirement, configuredForm, status: 'notConfigured' };
      }

      const completedDate = completedForms.get(normalize(configuredForm));
      return {
        ...requirement,
        configuredForm,
        status: completedDate !== undefined ? 'completed' : 'pending',
        completedDate,
      };
    });
  }, [completedForms, config.formsList, translatedRequirements]);

  const groupedRequirements = useMemo(() => {
    return requirementViewModels.reduce<Record<string, Array<RequirementViewModel>>>((groups, requirement) => {
      groups[requirement.section] = [...(groups[requirement.section] ?? []), requirement];
      return groups;
    }, {});
  }, [requirementViewModels]);

  const trackableRequirements = requirementViewModels.filter((requirement) => requirement.status !== 'notConfigured');
  const completedCount = trackableRequirements.filter((requirement) => requirement.status === 'completed').length;
  const pendingCount = trackableRequirements.length - completedCount;
  const unsupportedCount = requirementViewModels.length - trackableRequirements.length;
  const completionPercent = trackableRequirements.length
    ? Math.round((completedCount / trackableRequirements.length) * 100)
    : 0;

  const openFormsWorkspace = () => {
    launchWorkspace2(maternalHealthFormsWorkspace, { patientUuid });
  };

  if (error) {
    return (
      <Tile className={styles.complianceCard}>
        <div className={styles.headerRow}>
          <div>
            <p className={styles.eyebrow}>{t('pregnantMotherNts', 'NTS madre gestante')}</p>
            <h4>{t('maternalCareGaps', 'Brechas de atención materna')}</h4>
          </div>
          <Tag type="red">{t('error', 'Error')}</Tag>
        </div>
        <p className={styles.errorText}>
          {t('maternalNtsComplianceLoadError', 'No se pudo cargar el estado de cumplimiento NTS.')}
        </p>
      </Tile>
    );
  }

  return (
    <Tile className={styles.complianceCard}>
      <div className={styles.headerRow}>
        <div>
          <p className={styles.eyebrow}>NTS 105 / NTS 130</p>
          <h4>{t('maternalCareGaps', 'Brechas de atención materna')}</h4>
          <p className={styles.subtitle}>
            {t(
              'maternalCareGapsSubtitle',
              'Seguimiento operativo de atención prenatal reenfocada, parto institucional, puerperio y atención diferenciada.',
            )}
          </p>
        </div>
        <Button kind="tertiary" size="sm" renderIcon={Launch} onClick={openFormsWorkspace}>
          {t('openForms', 'Abrir formularios')}
        </Button>
      </div>

      {isLoading ? (
        <InlineLoading description={t('loadingMaternalNtsGaps', 'Cargando brechas NTS...')} />
      ) : (
        <>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{completionPercent}%</span>
              <span className={styles.summaryLabel}>{t('trackableProgress', 'avance trazable')}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{completedCount}</span>
              <span className={styles.summaryLabel}>{t('completedPlural', 'completos')}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{pendingCount}</span>
              <span className={styles.summaryLabel}>{t('pendingPlural', 'pendientes')}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{unsupportedCount}</span>
              <span className={styles.summaryLabel}>{t('withoutSupport', 'sin soporte')}</span>
            </div>
          </div>

          <div className={styles.sectionsGrid}>
            {Object.entries(groupedRequirements).map(([section, sectionRequirements]) => (
              <section className={styles.section} key={section}>
                <h5>{section}</h5>
                <ul className={styles.requirementsList}>
                  {sectionRequirements.map((requirement) => {
                    const meta = statusMeta[requirement.status];
                    const completedDate = formatDate(requirement.completedDate);

                    return (
                      <li className={styles.requirementItem} key={requirement.id}>
                        <div className={styles.requirementBody}>
                          <div className={styles.requirementTitleRow}>
                            <span className={styles.requirementTitle}>{requirement.label}</span>
                            <Tag type={meta.tagType}>{t(meta.labelKey, meta.label)}</Tag>
                          </div>
                          <p>{requirement.description}</p>
                          <span className={styles.source}>{requirement.source}</span>
                          {completedDate && (
                            <span className={styles.completedDate}>
                              {t('lastRecordDate', 'Último registro: {{completedDate}}', { completedDate })}
                            </span>
                          )}
                          {requirement.status === 'notConfigured' && (
                            <span className={styles.unsupportedNote}>
                              {t(
                                'requiresSpecificFormWorkflowOrBackendIntegration',
                                'Requiere formulario, workflow o integración backend específica.',
                              )}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </Tile>
  );
};

export default MaternalNtsCompliance;
