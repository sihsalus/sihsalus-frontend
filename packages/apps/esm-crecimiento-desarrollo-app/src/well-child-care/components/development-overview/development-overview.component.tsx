import { Button, Tile } from '@carbon/react';
import { Education } from '@carbon/react/icons';
import { userHasAccess, useSession } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { credEarlyStimulationEditPrivilege } from '../../../constants';
import { useCREDFormLauncher } from '../../../hooks/useCREDFormLauncher';

import styles from './development-overview.scss';

interface DevelopmentOverviewProps {
  patientUuid: string;
}

/**
 * Resumen de evaluaciones de desarrollo disponibles para uso clínico.
 */
const DevelopmentOverview: React.FC<DevelopmentOverviewProps> = () => {
  const { t } = useTranslation();
  const session = useSession();
  const canEdit = userHasAccess(credEarlyStimulationEditPrivilege, session?.user);
  const { launchForm: handleLaunchTepsi, isLoading: isTepsiFormLoading } = useCREDFormLauncher('tepsi');

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
      </div>
    </Tile>
  );
};

export default DevelopmentOverview;
