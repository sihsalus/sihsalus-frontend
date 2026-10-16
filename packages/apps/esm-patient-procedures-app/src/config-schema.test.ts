import { processConfig } from '@openmrs/esm-config';
import { describe, expect, it } from 'vitest';
import frontendConfig from '../../../../config/frontend.json';
import { configSchema } from './config-schema';

describe('procedures configuration', () => {
  it('uses the CIEL Procedure status question and its coded answers', () => {
    expect(configSchema.statusConceptUuid._default).toBe('f0d47b45-8303-4cdc-a9f2-c37135a3700f');
    expect(configSchema.statusConceptSourceType._default).toBe('Answer to');
  });

  it('uses the SIHSALUS time-unit concept set', () => {
    expect(configSchema.durationUnitConceptUuid._default).toBe('1732AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    expect(configSchema.durationUnitConceptSourceType._default).toBe('Concept set');
  });

  it('uses the institutional body-site set without changing other settings or the global Anatomy default', () => {
    const moduleName = '@sihsalus/esm-patient-procedures-app';
    const override = frontendConfig[moduleName];

    expect(override).toEqual({
      bodySiteConceptUuid: '25b4e8e6-0781-5c04-bc76-888402f3f505',
      bodySiteConceptSourceType: 'Concept set',
    });
    expect(processConfig(configSchema, override, moduleName)).toEqual({
      ...processConfig(configSchema, {}, moduleName),
      ...override,
    });
    expect(configSchema.bodySiteConceptUuid._default).toBe('8d491c7a-c2cc-11de-8d13-0010c6dffd0f');
    expect(configSchema.bodySiteConceptSourceType._default).toBe('Concept class');
  });
});
