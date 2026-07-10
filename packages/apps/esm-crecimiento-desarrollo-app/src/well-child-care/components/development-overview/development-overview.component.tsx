import { Button, Tile } from '@carbon/react';
import { Education } from '@carbon/react/icons';
import { userHasAccess, usePatient, useSession } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { credEarlyStimulationEditPrivilege } from '../../../constants';
import { useCREDFormLauncher } from '../../../hooks/useCREDFormLauncher';
import { calculateAgeInMonths } from '../../../utils/age-group-utils';

import styles from './development-overview.scss';

interface DevelopmentOverviewProps {
  patientUuid: string;
}

/**
 * Resumen de evaluaciones de desarrollo disponibles para uso clínico.
 */
const DevelopmentOverview: React.FC<DevelopmentOverviewProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(credEarlyStimulationEditPrivilege, session?.user);
  const { patient } = usePatient(patientUuid);
  const ageInMonths = patient?.birthDate ? calculateAgeInMonths(patient.birthDate) : null;
  const { launchForm: launchEdi, isLoading: isEdiLoading } = useCREDFormLauncher('ediDevelopmentForm');
  const { launchForm: launchHuanca, isLoading: isHuancaLoading } =
    useCREDFormLauncher('huancaNeurodevelopmentForm');
  const { launchForm: launchSkills, isLoading: isSkillsLoading } =
    useCREDFormLauncher('expectedSkillsBehaviorsForm');
  const { launchForm: launchMchat, isLoading: isMchatLoading } = useCREDFormLauncher('autismScreeningForm');

  const actions = [
    {
      key: 'edi',
      visible: ageInMonths !== null && ageInMonths >= 1 && ageInMonths < 61,
      title: t('ediTitle', 'Evaluación del Desarrollo Infantil (EDI)'),
      description: t(
        'ediSummaryDescription',
        'Registro resumido del resultado. La prueba se aplica con el instrumento oficial.',
      ),
      button: t('recordEdi', 'Registrar EDI'),
      launch: launchEdi,
      loading: isEdiLoading,
    },
    {
      key: 'huanca',
      visible: ageInMonths !== null && ageInMonths >= 2 && ageInMonths < 37,
      title: t('huancaTitle', 'Vigilancia del desarrollo Huanca'),
      description: t(
        'huancaSummaryDescription',
        'Registro resumido de hitos observados; no sustituye la aplicación de la ficha normativa.',
      ),
      button: t('recordHuanca', 'Registrar vigilancia'),
      launch: launchHuanca,
      loading: isHuancaLoading,
    },
    {
      key: 'mchat',
      visible: ageInMonths !== null && ageInMonths >= 18 && ageInMonths < 31,
      title: t('mchatTitle', 'Tamizaje TEA (M-CHAT-R/F)'),
      description: t(
        'mchatSummaryDescription',
        'Universal a los 24 meses; entre 18 y 30 meses también corresponde si existe riesgo.',
      ),
      button: t('recordMchat', 'Registrar tamizaje'),
      launch: launchMchat,
      loading: isMchatLoading,
    },
    {
      key: 'skills',
      visible: ageInMonths !== null && ageInMonths >= 48 && ageInMonths < 144,
      title: t('expectedSkillsTitle', 'Habilidades y conductas esperadas'),
      description: t(
        'expectedSkillsSummaryDescription',
        'Registro resumido por áreas; aplicar la lista normativa correspondiente a la edad.',
      ),
      button: t('recordExpectedSkills', 'Registrar habilidades'),
      launch: launchSkills,
      loading: isSkillsLoading,
    },
  ].filter(({ visible }) => visible);

  if (actions.length === 0) return null;

  return (
    <Tile className={styles.card}>
      <div className={styles.header}>
        <h5>{t('developmentOverview', 'Evaluación del Desarrollo')}</h5>
      </div>

      <div className={styles.testCards}>
        {actions.map((action) => (
          <div className={styles.testCard} key={action.key}>
            <div className={styles.testInfo}>
              <h6>{action.title}</h6>
              <p className={styles.description}>{action.description}</p>
            </div>
            <Button
              kind="tertiary"
              size="sm"
              renderIcon={Education}
              onClick={() => action.launch()}
              disabled={action.loading || !canEdit}
            >
              {action.button}
            </Button>
          </div>
        ))}
      </div>
    </Tile>
  );
};

export default DevelopmentOverview;
