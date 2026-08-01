import { type OmrsOfflineHttpHeaders, omrsOfflineCachingStrategyHttpHeaderName } from '@openmrs/esm-framework';

export const cacheForOfflineHeaders: OmrsOfflineHttpHeaders = {
  [omrsOfflineCachingStrategyHttpHeaderName]: 'network-first',
};

export const patientListsEditPrivilege = 'app:home.listasPacientes.editar';
