import { useConfig } from '@openmrs/esm-framework';
import { ConditionConceptSetForm, type ConditionConceptSetWorkspaceProps } from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import type { ConfigObject } from '../../config-schema';
import { prenatalCareEditPrivilege } from '../../constants';

export { createConditionConceptSetSchema as createSchema } from '@openmrs/esm-patient-common-lib';

export default function ConditionsForm(props: ConditionConceptSetWorkspaceProps) {
  const config = useConfig<ConfigObject>();
  return (
    <RequirePrivilege privilege={prenatalCareEditPrivilege}>
      <ConditionConceptSetForm
        {...props}
        translationNamespace="@sihsalus/esm-salud-materna-app"
        defaultConceptSetUuid={config?.conditionConceptSets?.antecedentesPatologicos?.uuid}
      />
    </RequirePrivilege>
  );
}
