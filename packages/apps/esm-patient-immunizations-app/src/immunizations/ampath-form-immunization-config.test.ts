import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import { resolvePublishedForm } from '@openmrs/esm-patient-common-lib';
import { configSchema, type ImmunizationConfigObject } from '../config-schema';
import { resolveAmpathImmunizationForm } from './ampath-form-immunization-config';

vi.mock('@openmrs/esm-patient-common-lib', () => ({ resolvePublishedForm: vi.fn() }));

const config = getDefaultsFromConfigSchema(configSchema) as ImmunizationConfigObject;

describe('AMPATH immunization Form identity', () => {
  it('resolves the published name/version, never the top-level JSON UUID', async () => {
    vi.mocked(resolvePublishedForm).mockResolvedValue({
      uuid: '06b94846-f1db-3851-8448-2a97dba81478',
      name: 'INMU-001-REGISTRO DE VACUNACIÓN',
      version: '1.1.0',
      published: true,
      retired: false,
      resources: [],
    });
    expect((await resolveAmpathImmunizationForm(config)).uuid).toBe('06b94846-f1db-3851-8448-2a97dba81478');
    expect(resolvePublishedForm).toHaveBeenCalledWith('INMU-001-REGISTRO DE VACUNACIÓN', {
      name: 'INMU-001-REGISTRO DE VACUNACIÓN',
      version: '1.1.0',
      formCategory: 'Immunization',
    });
  });

  it('verifies explicit UUID overrides against the same name/version contract', async () => {
    const unavailable = new Error('The configured Form is retired or ambiguous');
    vi.mocked(resolvePublishedForm).mockRejectedValue(unavailable);
    const overridden = {
      ...config,
      ampathFormPersistence: { ...config.ampathFormPersistence, formUuid: 'c1120000-0000-4000-8000-000000000011' },
    };
    await expect(resolveAmpathImmunizationForm(overridden)).rejects.toBe(unavailable);
    expect(resolvePublishedForm).toHaveBeenLastCalledWith('c1120000-0000-4000-8000-000000000011', {
      name: 'INMU-001-REGISTRO DE VACUNACIÓN',
      version: '1.1.0',
      formCategory: 'Immunization',
    });
  });

  it('rejects an incomplete Form contract even when a UUID override is present', async () => {
    await expect(
      resolveAmpathImmunizationForm({
        ...config,
        ampathFormPersistence: {
          ...config.ampathFormPersistence,
          formUuid: 'c1120000-0000-4000-8000-000000000011',
          formVersion: '',
        },
      }),
    ).rejects.toThrow('name and version are required');
  });
});
