import { OverflowMenuItem } from '@carbon/react';
import { navigate } from '@openmrs/esm-framework';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { spaHomePage } from '../constants';

interface ScheduleAppointmentActionProps {
  closeMenu?: () => void;
  patientUuid: string;
}

const ScheduleAppointmentAction: React.FC<ScheduleAppointmentActionProps> = ({ closeMenu, patientUuid }) => {
  const { t } = useTranslation();

  const handleScheduleAppointment = useCallback(() => {
    closeMenu?.();
    navigate({
      to: `${spaHomePage}/appointments/patient/${patientUuid}?action=create`,
    });
  }, [closeMenu, patientUuid]);

  return (
    <OverflowMenuItem itemText={t('scheduleAppointment', 'Schedule appointment')} onClick={handleScheduleAppointment} />
  );
};

export default ScheduleAppointmentAction;
