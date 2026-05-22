import { defineConfigSchema } from '@openmrs/esm-config';
import { configSchema } from './config-schema';
import { refetchCurrentUser } from './current-user';

/**
 * @internal
 */
export function setupApiModule() {
  defineConfigSchema('@openmrs/esm-api', configSchema);

  refetchCurrentUser();
}
