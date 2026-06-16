import { type OmrsOfflineHttpHeaders, omrsOfflineCachingStrategyHttpHeaderName } from '@openmrs/esm-framework';

export const personRelationshipRepresentation =
  'custom:(display,uuid,' +
  'personA:(age,display,birthdate,uuid),' +
  'personB:(age,display,birthdate,uuid),' +
  'relationshipType:(uuid,display,description,aIsToB,bIsToA))';

export const moduleName = '@sihsalus/esm-patient-registration-app';
export const patientRegistration = 'patient-registration';

// Feature flag that toggles the external identity lookups (RENIEC / SIS) in the
// registration form. Disabled by default, so the lookups stay hidden until enabled.
export const externalIdentityLookupsFlag = 'patient-registration-external-lookups';

export const cacheForOfflineHeaders: OmrsOfflineHttpHeaders = {
  [omrsOfflineCachingStrategyHttpHeaderName]: 'network-first',
};
