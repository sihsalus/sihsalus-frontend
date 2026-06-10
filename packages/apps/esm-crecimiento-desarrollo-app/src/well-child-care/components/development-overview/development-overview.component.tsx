import { Button, Tile } from '@carbon/react';
import { Education, Growth } from '@carbon/react/icons';
import { launchWorkspace2, useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { credEarlyStimulationEditPrivilege } from '../../../constants';
import type { ConfigObject } from '../../../config-schema';
import { useCREDFormLauncher } from '../../../hooks/useCREDFormLauncher';
import { useHasPrivilege } from '../../../rbac';

import styles from './development-overview.scss';

interface DevelopmentOverviewProps {
  patientUuid: string;
}

/**
 * Resumen de evaluaciones de desarrollo (TEPSI y Test Peruano).
 * Muestra botones para lanzar los formularios workspace de cada test.
 */
const DevelopmentOverview: React.FC<DevelopmentOverviewProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const canEdit = useHasPrivilege(credEarlyStimulationEditPrivilege);
  const { launchForm: handleLaunchTepsi, isLoading: isTepsiFormLoading } = useCREDFormLauncher('tepsi');
  const isTestPeruanoConfigured = Boolean(config.testPeruano?.formUuid && config.testPeruano?.concepts?.snapshotUuid);

  const handleLaunchTestPeruano = () => {
    launchWorkspace2('test-peruano-form', { patientUuid });
  };

  return (
    <Tile className={styles.card}>
      <div className={styles.header}>
        <h5>{t('developmentOverview', 'Evaluación del Desarrollo')}</h5>
      </div>

      <div className={styles.testCards}>
        <div className={styles.testCard}>
          <div className={styles.testInfo}>
            <h6>{t('tepsiTitle', 'Test de Desarrollo Psicomotor (TEPSI)')}</h6>
            <p className={styles.description}>
              {t('tepsiDescription', 'Evaluación del desarrollo psicomotor (2-5 años)')}
            </p>
          </div>
          <Button
            kind="tertiary"
            size="sm"
            renderIcon={Education}
            onClick={() => handleLaunchTepsi()}
            disabled={isTepsiFormLoading || !canEdit}
          >
            {t('startTepsi', 'Realizar TEPSI')}
          </Button>
        </div>

        <div className={styles.testCard}>
          <div className={styles.testInfo}>
            <h6>{t('testPeruanoTitle', 'Test Peruano de Desarrollo Infantil')}</h6>
            <p className={styles.description}>
              {t('testPeruanoDescription', 'Evaluación del desarrollo infantil adaptada al contexto peruano')}
            </p>
          </div>
          <Button
            kind="tertiary"
            size="sm"
            renderIcon={Growth}
            onClick={handleLaunchTestPeruano}
            disabled={!isTestPeruanoConfigured || !canEdit}
          >
            {t('startTestPeruano', 'Realizar Test Peruano')}
          </Button>
        </div>
      </div>
    </Tile>
  );
};

export default DevelopmentOverview;
