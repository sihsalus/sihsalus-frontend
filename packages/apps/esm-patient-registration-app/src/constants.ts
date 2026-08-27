import { type OmrsOfflineHttpHeaders, omrsOfflineCachingStrategyHttpHeaderName } from '@openmrs/esm-framework';

export const personRelationshipRepresentation =
  'custom:(display,uuid,' +
  'personA:(age,display,birthdate,birthdateEstimated,uuid),' +
  'personB:(age,display,birthdate,birthdateEstimated,uuid),' +
  'relationshipType:(uuid,display,description,aIsToB,bIsToA))';

export const moduleName = '@sihsalus/esm-patient-registration-app';
export const defaultSisOnlineVerificationUrl = 'http://app8.susalud.gob.pe:8380/acreditacion/busqueda-asegurado:newSearch=true';
export const patientRegistration = 'patient-registration';
export const patientImport = 'patient-import';

// Feature flag that toggles the external identity lookups (RENIEC / SIS) in the
// registration form. Disabled by default, so the lookups stay hidden until enabled.
export const externalIdentityLookupsFlag = 'patient-registration-external-lookups';

/**
 * Width of the `person_attribute.value` column in OpenMRS. A value longer than
 * this is rejected or silently truncated on save, so the form has to stop it
 * before the user gets that far.
 */
export const personAttributeValueMaxLength = 50;

export const cacheForOfflineHeaders: OmrsOfflineHttpHeaders = {
  [omrsOfflineCachingStrategyHttpHeaderName]: 'network-first',
};
