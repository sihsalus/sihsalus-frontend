import {
  getDefaultsFromConfigSchema,
  openmrsFetch,
  useConfig,
  useEmrConfiguration,
  useSession,
  useVisit,
} from '@openmrs/esm-framework';
import { act, renderHook } from '@testing-library/react';
import { configSchema, type OdontogramConfig } from '../config-schema';
import { childConfig } from '../odontogram/config/childConfig';
import { createEmptyOdontogramData } from '../odontogram/types/odontogram';
import { useOdontogramEncounter } from './useOdontogramEncounter';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-framework')>()),
  useEmrConfiguration: vi.fn(),
  useVisit: vi.fn(),
}));

const config = getDefaultsFromConfigSchema(configSchema) as OdontogramConfig;
const data = createEmptyOdontogramData(childConfig);
const params = { patientUuid: 'patient-a', data, recordType: 'base' as const };
const activeVisit = { uuid: 'active-visit', patient: { uuid: 'patient-a' }, stopDatetime: null };

beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue(config);
  vi.mocked(useSession).mockReturnValue({
    currentProvider: { uuid: 'session-provider' },
    sessionLocation: { uuid: 'session-location' },
  } as never);
  vi.mocked(useVisit).mockReturnValue({ activeVisit, isLoading: false, error: undefined } as never);
  vi.mocked(useEmrConfiguration).mockReturnValue({
    emrConfiguration: { clinicianEncounterRole: { uuid: 'configured-clinician-role' } },
    isLoadingEmrConfiguration: false,
  } as never);
  vi.mocked(openmrsFetch).mockResolvedValue({ data: { uuid: 'saved' } } as never);
});

it.each(['base', 'attention'] as const)(
  'creates a primary %s in the exact active visit with session and configured provider attribution',
  async (recordType) => {
    const { result } = renderHook(() => useOdontogramEncounter('patient-a'));
    await act(async () => {
      await result.current.save({
        ...params,
        recordType,
        baseEncounterUuid: recordType === 'attention' ? 'original-base' : undefined,
      });
    });
    expect(useVisit).toHaveBeenCalledWith('patient-a');
    expect(openmrsFetch).toHaveBeenCalledTimes(1);
    expect(openmrsFetch).toHaveBeenCalledWith(
      '/ws/rest/v1/encounter',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          patient: 'patient-a',
          visit: 'active-visit',
          location: 'session-location',
          encounterProviders: [{ provider: 'session-provider', encounterRole: 'configured-clinician-role' }],
          form:
            recordType === 'base'
              ? config.ampathFormPersistence.baseFormUuid
              : config.ampathFormPersistence.attentionFormUuid,
        }),
      }),
    );
    const body = vi.mocked(openmrsFetch).mock.calls[0][1].body as { obs: { concept: string; value: string }[] };
    expect(body.obs).toContainEqual({
      concept: config.ampathFormPersistence.concepts.snapshot,
      value: JSON.stringify(data),
    });
    if (recordType === 'attention')
      expect(body.obs).toContainEqual({
        concept: config.ampathFormPersistence.concepts.parentBaseEncounterUuid,
        value: 'original-base',
      });
  },
);

it.each([
  'missing-visit',
  'stopped-visit',
  'other-patient-visit',
  'loading-visit',
  'visit-error',
  'missing-provider',
  'missing-location',
  'missing-role',
  'loading-role',
  'role-error',
  'different-save-patient',
])('rejects creation before POST when context is %s', async (scenario) => {
  if (scenario.includes('visit'))
    vi.mocked(useVisit).mockReturnValue({
      activeVisit:
        scenario === 'missing-visit'
          ? null
          : {
              ...activeVisit,
              ...(scenario === 'stopped-visit' ? { stopDatetime: '2026-10-09T12:00:00Z' } : {}),
              ...(scenario === 'other-patient-visit' ? { patient: { uuid: 'patient-b' } } : {}),
            },
      isLoading: scenario === 'loading-visit',
      error: scenario === 'visit-error' ? new Error('Synthetic read failure') : undefined,
    } as never);
  if (scenario === 'missing-provider' || scenario === 'missing-location')
    vi.mocked(useSession).mockReturnValue({
      currentProvider: scenario === 'missing-provider' ? null : { uuid: 'session-provider' },
      sessionLocation: scenario === 'missing-location' ? null : { uuid: 'session-location' },
    } as never);
  if (scenario.includes('role'))
    vi.mocked(useEmrConfiguration).mockReturnValue({
      emrConfiguration:
        scenario === 'missing-role' ? {} : { clinicianEncounterRole: { uuid: 'configured-clinician-role' } },
      isLoadingEmrConfiguration: scenario === 'loading-role',
      errorFetchingEmrConfiguration:
        scenario === 'role-error' ? new Error('Synthetic configuration failure') : undefined,
    } as never);
  const { result } = renderHook(() => useOdontogramEncounter('patient-a'));
  await act(async () => {
    await expect(
      result.current.save({
        ...params,
        ...(scenario === 'different-save-patient' ? { patientUuid: 'patient-b' } : {}),
      }),
    ).rejects.toMatchObject({ code: 'ODONTOGRAM_CREATE_CONTEXT_UNAVAILABLE' });
  });
  expect(openmrsFetch).not.toHaveBeenCalled();
  expect(result.current.isSaving).toBe(false);
});

it('updates only observations of the verified historical encounter without replacing original clinical context', async () => {
  vi.mocked(useVisit).mockReturnValue({ activeVisit: null, isLoading: false } as never);
  vi.mocked(useSession).mockReturnValue(null);
  vi.mocked(useEmrConfiguration).mockReturnValue({} as never);
  vi.mocked(openmrsFetch).mockResolvedValueOnce({
    data: {
      uuid: 'historical-encounter',
      patient: { uuid: 'patient-a' },
      visit: { uuid: 'original-closed-visit' },
      location: { uuid: 'original-location' },
      encounterProviders: [{ provider: { uuid: 'original-provider' } }],
      obs: [{ uuid: 'original-snapshot-obs', concept: { uuid: config.ampathFormPersistence.concepts.snapshot } }],
    },
  } as never);
  const { result } = renderHook(() => useOdontogramEncounter('patient-a'));
  await act(async () => {
    await result.current.save({ ...params, encounterUuid: 'historical-encounter' });
  });
  const [url, request] = vi.mocked(openmrsFetch).mock.calls[1];
  expect(url).toBe('/ws/rest/v1/encounter/historical-encounter');
  expect(request.method).toBe('POST');
  expect(Object.keys(request.body)).toEqual(['obs']);
  expect(request.body).toMatchObject({
    obs: expect.arrayContaining([
      {
        uuid: 'original-snapshot-obs',
        concept: config.ampathFormPersistence.concepts.snapshot,
        value: JSON.stringify(data),
      },
    ]),
  });
});

it.each(['patient', 'encounter', 'missing-observations', 'read-error'])(
  'does not update when the historical %s cannot be verified',
  async (scenario) => {
    if (scenario === 'read-error') vi.mocked(openmrsFetch).mockRejectedValueOnce(new Error('Synthetic read failure'));
    else
      vi.mocked(openmrsFetch).mockResolvedValueOnce({
        data: {
          uuid: scenario === 'encounter' ? 'other-encounter' : 'historical-encounter',
          patient: { uuid: scenario === 'patient' ? 'patient-b' : 'patient-a' },
          ...(scenario !== 'missing-observations' ? { obs: [] } : {}),
        },
      } as never);
    const { result } = renderHook(() => useOdontogramEncounter('patient-a'));
    await act(async () => {
      await expect(result.current.save({ ...params, encounterUuid: 'historical-encounter' })).rejects.toThrow();
    });
    expect(openmrsFetch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(openmrsFetch).mock.calls[0][1]?.method).not.toBe('POST');
  },
);
