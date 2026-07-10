import { describe, expect, it } from 'vitest';
import { configSchema } from './config-schema';

describe('procedures configuration', () => {
  it('uses the CIEL Procedure status question and its coded answers', () => {
    expect(configSchema.statusConceptUuid._default).toBe('f0d47b45-8303-4cdc-a9f2-c37135a3700f');
    expect(configSchema.statusConceptSourceType._default).toBe('Answer to');
  });
});
