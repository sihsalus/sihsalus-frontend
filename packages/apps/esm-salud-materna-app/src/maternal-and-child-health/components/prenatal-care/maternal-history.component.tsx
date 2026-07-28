import { useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../../../config-schema';
import { prenatalCareEditPrivilege } from '../../../constants';
import PatientObservationGroupTable from '../../../ui/patient-observation-group-table/patient-observation-group-table.component';

interface MaternalHistoryProps {
  patientUuid: string;
}

const MaternalHistory: React.FC<MaternalHistoryProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const config = useConfig() as ConfigObject;
  const headerTitle = t('maternaHistory', 'Antecedente de Historia Materna');
  const displayText = t('noDataAvailableDescription', 'No data available');
  const formWorkspace = config.formsList.maternalHistory;

  return (
    <PatientObservationGroupTable
      patientUuid={patientUuid}
      headerTitle={headerTitle}
      displayText={displayText}
      encounterType={config.encounterTypes.prenatalControl}
      formUuid={config.formsList.maternalHistory}
      editPrivilege={prenatalCareEditPrivilege}
      formWorkspace={formWorkspace}
    />
  );
};

export default MaternalHistory;
