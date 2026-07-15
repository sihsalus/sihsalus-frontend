import { Button, Tag, Tile } from '@carbon/react';
import { Add, CheckmarkFilled, Edit, WarningFilled } from '@carbon/react/icons';
import { useConfig } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import type { ConfigObject } from '../../../../config-schema';
import { prenatalCareEditPrivilege } from '../../../../constants';
import { useBirthPlan } from '../../../../hooks/useBirthPlan';
import { useMaternalFormIdentifierLauncher } from '../../../../hooks/useMaternalFormLauncher';

import styles from './birth-plan.scss';

interface BirthPlanProps {
  patientUuid: string;
}

/**
 * Widget de plan de parto según NTS 105-MINSA.
 * Muestra si la gestante tiene plan de parto elaborado a partir de semana 32.
 * Permite crear/editar usando Ampath Form: OBST-004-FICHA PLAN DE PARTO
 */
const BirthPlan: React.FC<BirthPlanProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const { hasBirthPlan, planDate, referenceHospital, encounterUuid, isLoading, error, mutate } =
    useBirthPlan(patientUuid);
  const formIdentifier = config.birthPlan?.formUuid || config.formsList?.birthPlanForm;
  const { launchForm: launchBirthPlanForm } = useMaternalFormIdentifierLauncher(
    formIdentifier,
    t('birthPlan', 'Plan de Parto'),
  );

  const handleLaunchBirthPlanForm = useCallback(() => {
    launchBirthPlanForm(encounterUuid ?? '', () => void mutate());
  }, [encounterUuid, launchBirthPlanForm, mutate]);

  if (isLoading) return <Tile className={styles.card}>{t('loading', 'Loading...')}</Tile>;

  return (
    <Tile className={styles.card}>
      <div className={styles.header}>
        <h5>{t('birthPlan', 'Plan de Parto')}</h5>
        <div className={styles.headerActions}>
          <Tag type={hasBirthPlan ? 'green' : 'red'} size="sm">
            {hasBirthPlan ? t('elaborated', 'Elaborado') : t('pending', 'Pending')}
          </Tag>
          <RequirePrivilege privilege={prenatalCareEditPrivilege} hideUnauthorized>
            <Button
              kind="ghost"
              size="sm"
              renderIcon={hasBirthPlan ? Edit : Add}
              onClick={handleLaunchBirthPlanForm}
              iconDescription={hasBirthPlan ? t('editBirthPlan', 'Editar plan') : t('createBirthPlan', 'Crear plan')}
            >
              {hasBirthPlan ? t('edit', 'Edit') : t('create', 'Crear')}
            </Button>
          </RequirePrivilege>
        </div>
      </div>
      <div className={styles.content}>
        <div className={styles.row}>
          {hasBirthPlan ? (
            <CheckmarkFilled size={16} className={styles.iconSuccess} />
          ) : (
            <WarningFilled size={16} className={styles.iconWarning} />
          )}
          <span>{t('birthPlanStatus', hasBirthPlan ? 'Plan elaborado' : 'Plan de parto no registrado')}</span>
        </div>
        {planDate && (
          <div className={styles.row}>
            <span className={styles.label}>{t('planDate', 'Fecha de elaboración')}:</span>
            <span className={styles.value}>{planDate}</span>
          </div>
        )}
        {referenceHospital && (
          <div className={styles.row}>
            <span className={styles.label}>{t('referenceHospital', 'Hospital de referencia')}:</span>
            <span className={styles.value}>{referenceHospital}</span>
          </div>
        )}
      </div>
      {error && <p className={styles.error}>{t('errorLoading', 'Error al cargar datos')}</p>}
    </Tile>
  );
};

export default BirthPlan;
