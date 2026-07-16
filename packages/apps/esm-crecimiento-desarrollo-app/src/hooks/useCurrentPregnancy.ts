import { useConfig } from '@openmrs/esm-framework';
import { useFilteredEncounter } from '@openmrs/esm-patient-common-lib';

import type { ConfigObject } from '../config-schema';

export const useCurrentPregnancy = (patientUuid: string) => {
  const config = useConfig<ConfigObject>();
  return useFilteredEncounter(
    patientUuid,
    config?.encounterTypes?.prenatalControl,
    config?.formsList?.currentPregnancy,
  );
};
