import { useConfig } from '@openmrs/esm-framework';
import { type Condition, isPathologicalAntecedentType } from '@openmrs/esm-patient-common-lib';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConfigObject } from '../config-schema';
import GenericConditionsOverview from '../ui/conditions-filter/generic-conditions-overview.component';

interface AntecedentesPatologicosProps {
  patientUuid: string;
}

const isPatientPathology = (condition: Condition) => isPathologicalAntecedentType(condition.antecedentType);

const AntecedentesPatologicos: React.FC<AntecedentesPatologicosProps> = ({ patientUuid }) => {
  const config = useConfig<ConfigObject>();
  const { t } = useTranslation();

  // Get configuration for Antecedentes Patológicos
  const conceptSetConfig = config?.conditionConceptSets?.antecedentesPatologicos;

  if (!conceptSetConfig) {
    console.error('Configuration for Antecedentes Patológicos not found');
    return null;
  }

  return (
    <GenericConditionsOverview
      patientUuid={patientUuid}
      conceptSetUuid={conceptSetConfig.uuid}
      conditionFilter={isPatientPathology}
      title={t('antecedentesPatologicos', conceptSetConfig.title)}
      workspaceFormId="antecedentes-patologicos-form-workspace"
      enableAdd={true}
      urlPath="AntecedentesPatologicos"
    />
  );
};

export default AntecedentesPatologicos;
