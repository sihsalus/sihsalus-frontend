import { Button } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { ExtensionSlot, launchWorkspace2, showSnackbar } from '@openmrs/esm-framework';
import { CardHeader } from '@openmrs/esm-patient-common-lib';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { credImmunizationEditPrivilege } from '../../../constants';
import { useHasPrivilege } from '../../../rbac';
import styles from './vaccination-schedule.scss';

interface VaccinationScheduleProps {
  patientUuid: string;
}

const VaccinationSchedule: React.FC<VaccinationScheduleProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const canEdit = useHasPrivilege(credImmunizationEditPrivilege);

  const headerTitle = t('vaccinationSchedule', 'Calendario de Vacunación');

  const handleAddVaccination = useCallback(() => {
    try {
      launchWorkspace2('immunization-form-workspace', {
        patientUuid,
        workspaceTitle: t('addVaccination', 'Añadir Vacuna'),
      });
    } catch {
      showSnackbar({
        title: t('immunizationFormNotAvailable', 'Formulario de inmunización no disponible'),
        subtitle: t(
          'immunizationFormNotAvailableSubtitle',
          'El módulo de inmunizaciones no está instalado. Registre vacunas desde el formulario de inmunizaciones del paciente.',
        ),
        kind: 'warning',
      });
    }
  }, [patientUuid, t]);

  return (
    <div className={styles.widgetCard} role="region" aria-label={headerTitle}>
      <CardHeader title={headerTitle}>
        {canEdit && (
          <Button
            kind="ghost"
            renderIcon={(props) => <Add size={16} {...props} />}
            onClick={handleAddVaccination}
            aria-label={t('updateVaccinations', 'Actualizar vacunas')}
          >
            {t('update', 'Actualizar')}
          </Button>
        )}
      </CardHeader>

      <ExtensionSlot
        name="patient-chart-vacunacion-dashboard-slot"
        state={{
          patientUuid,
          basePath: 'Vacunacion',
        }}
      />
    </div>
  );
};

export default VaccinationSchedule;
