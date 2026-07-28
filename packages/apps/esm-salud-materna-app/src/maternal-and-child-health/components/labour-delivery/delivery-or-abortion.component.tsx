import { useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../../config-schema';
import { labourDeliveryEditPrivilege } from '../../../constants';
import PatientObservationGroupTable from '../../../ui/patient-observation-group-table/patient-observation-group-table.component';

interface DeliveryOrAbortionProps {
  patientUuid: string;
}

const DeliveryOrAbortion: React.FC<DeliveryOrAbortionProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig() as ConfigObject;
  const headerTitle = t('deliveryOrAbortion', 'Parto o Aborto');
  const displayText = t('noDataAvailableDescription', 'No data available');
  const formWorkspace = config.formsList.deliveryOrAbortion;

  return (
    <PatientObservationGroupTable
      patientUuid={patientUuid}
      headerTitle={headerTitle}
      displayText={displayText}
      encounterType={config.encounterTypes.prenatalControl}
      formUuid={config.formsList.deliveryOrAbortion}
      editPrivilege={labourDeliveryEditPrivilege}
      formWorkspace={formWorkspace}
    />
  );
};

export default DeliveryOrAbortion;
