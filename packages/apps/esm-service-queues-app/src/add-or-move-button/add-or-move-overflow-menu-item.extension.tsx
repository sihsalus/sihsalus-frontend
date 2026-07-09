import { OverflowMenuItem, SkeletonText } from '@carbon/react';
import { showModal, useVisit } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface AddOrMoveOverflowMenuItemProps {
  patientUuid: string;
}

const AddOrMoveOverflowMenuItem: React.FC<AddOrMoveOverflowMenuItemProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { activeVisit, isLoading } = useVisit(patientUuid) || {};

  const handleLaunchModal = () => {
    const dispose = showModal('transition-patient-to-latest-queue-modal', {
      closeModal: () => dispose(),
      activeVisit,
    });
  };

  if (!activeVisit) {
    return null;
  }

  if (isLoading) {
    return <SkeletonText />;
  }

  return <OverflowMenuItem itemText={t('transitionPatientAction', 'Transition patient')} onClick={handleLaunchModal} />;
};

export default AddOrMoveOverflowMenuItem;
