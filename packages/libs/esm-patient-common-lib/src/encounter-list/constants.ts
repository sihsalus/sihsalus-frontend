/**
 * OpenMRS concept UUID for the boolean "True" value.
 *
 * Used when evaluating coded obs that represent yes/no flags (e.g. "Is patient
 * on ART?"). Compare an obs value's `uuid` against this constant instead of
 * using magic strings spread across modules.
 *
 * @example
 * ```ts
 * const isOnArt = obs.value?.uuid === TRUE_CONCEPT_UUID;
 * ```
 */
export const TRUE_CONCEPT_UUID = 'cf82933b-3f3f-45e7-a5ab-5d31aaee3da3';
export const OPENMRS_LEGACY_BOOLEAN_FALSE_CONCEPT_UUID = '1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const OPENMRS_LEGACY_BOOLEAN_TRUE_CONCEPT_UUID = '2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
