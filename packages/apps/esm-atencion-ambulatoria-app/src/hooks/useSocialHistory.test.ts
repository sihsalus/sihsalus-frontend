import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { renderHook } from '@testing-library/react';
import { configSchema } from '../config-schema';
import { useMergedClinicalHistoryPagination } from './useClinicalHistoryPagination';
import { useSocialHistory } from './useSocialHistory';

vi.mock('./useClinicalHistoryPagination', () => ({ useMergedClinicalHistoryPagination: vi.fn() }));

it('uses the dedicated content contract and verifies patient/type/form across paginated history', () => {
  const config = getDefaultsFromConfigSchema(configSchema);
  vi.mocked(useConfig).mockReturnValue(config);
  renderHook(() => useSocialHistory('synthetic-patient'));
  const source = vi.mocked(useMergedClinicalHistoryPagination).mock.calls[0][0][0];
  expect(source).toMatchObject({
    expectedFormUuid: config.socialHistory.formUuid,
    expectedPatientUuid: 'synthetic-patient',
    expectedEncounterTypeUuid: config.socialHistory.encounterTypeUuid,
  });
  const url = new URL(source.url, 'http://localhost');
  expect(url.searchParams.get('patient')).toBe('synthetic-patient');
  expect(url.searchParams.get('encounterType')).toBe(config.socialHistory.encounterTypeUuid);
  expect(url.searchParams.has('form')).toBe(false); // Not a supported REST search filter.
  expect(source.url).not.toContain(config.clinicalEncounterUuid);
});
