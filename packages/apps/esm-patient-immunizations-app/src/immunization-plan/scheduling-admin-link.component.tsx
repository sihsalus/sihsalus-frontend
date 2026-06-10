import { ClickableTile, Layer } from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';

const SchedulingAdminLink: React.FC = () => {
  const { t } = useTranslation();
  const schedulingUrl = `${globalThis.spaBase}/vaccine-scheduling-builder`;

  const handleOpenSchedulingAdmin = (
    event: React.MouseEvent<HTMLAnchorElement> | React.KeyboardEvent<HTMLAnchorElement>,
  ) => {
    event.preventDefault();
    globalThis.open(schedulingUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Layer>
      <ClickableTile href={schedulingUrl} onClick={handleOpenSchedulingAdmin}>
        <div>
          <div className="heading">{t('manageVaccinationSchedule', 'Manage Schedule')}</div>
          <div className="content">{t('vaccinationScheduleBuilder', 'Vaccination Schedule')}</div>
        </div>
        <div className="iconWrapper">
          <ArrowRight size={16} />
        </div>
      </ClickableTile>
    </Layer>
  );
};

export default SchedulingAdminLink;
