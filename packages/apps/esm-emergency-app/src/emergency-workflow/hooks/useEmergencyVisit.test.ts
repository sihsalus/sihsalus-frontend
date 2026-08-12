import { getDefaultsFromConfigSchema, openmrsFetch, showSnackbar, useConfig } from '@openmrs/esm-framework';
import {
  assertFreshPatientIsAlive,
  DECEASED_PATIENT_OPERATION_BLOCKED,
  PATIENT_VITAL_STATUS_UNAVAILABLE,
} from '@openmrs/esm-patient-common-lib';
import { act, renderHook } from '@testing-library/react';
import { type Config, configSchema } from '../../config-schema';
import {
  EMERGENCY_LOCATION_UNAVAILABLE,
  EMERGENCY_VISIT_UUID_UNAVAILABLE,
  useEmergencyVisit,
} from './useEmergencyVisit';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig<Config>);
const mockAssertFreshPatientIsAlive = vi.mocked(assertFreshPatientIsAlive);

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  assertFreshPatientIsAlive: vi.fn(),
}));

describe('useEmergencyVisit', () => {
  const config: Config = {
    ...(getDefaultsFromConfigSchema(configSchema) as Config),
    emergencyVisitTypeUuid: '11111111-1111-4111-8111-111111111111',
    emergencyLocationUuid: '22222222-2222-4222-8222-222222222222',
    patientRegistration: {
      ...(getDefaultsFromConfigSchema(configSchema) as Config).patientRegistration,
      defaultLocationUuid: '22222222-2222-4222-8222-222222222222',
      administrativeNotesVisitAttributeTypeUuid: '6ffc9f6b-a9fb-434e-9b2d-4a2591cc16b3',
    },
  };

  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
    mockShowSnackbar.mockReset();
    mockUseConfig.mockReturnValue(config);
    mockAssertFreshPatientIsAlive.mockReset();
    mockAssertFreshPatientIsAlive.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
  });

  it('creates an emergency visit at the provided arrival time and stores administrative notes as a visit attribute', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { uuid: 'visit-uuid' } } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce({ data: { uuid: 'visit-attribute-uuid' } } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce({
        data: {
          attributes: [
            {
              uuid: 'visit-attribute-uuid',
              attributeType: { uuid: '6ffc9f6b-a9fb-434e-9b2d-4a2591cc16b3' },
              value: 'Ingreso por SAMU sin documentos',
            },
          ],
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useEmergencyVisit());
    let visitUuid: string | null = null;

    await act(async () => {
      visitUuid = await result.current.createEmergencyVisit(
        'patient-uuid',
        '2026-05-30T10:15:00-05:00',
        'Ingreso por SAMU sin documentos',
      );
    });

    expect(visitUuid).toBe('visit-uuid');
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(1, '/ws/rest/v1/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        patient: 'patient-uuid',
        visitType: '11111111-1111-4111-8111-111111111111',
        location: '22222222-2222-4222-8222-222222222222',
        startDatetime: '2026-05-30T15:15:00.000Z',
      },
    });
    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledWith('patient-uuid');
    expect(mockAssertFreshPatientIsAlive.mock.invocationCallOrder[0]).toBeLessThan(
      mockOpenmrsFetch.mock.invocationCallOrder[0],
    );
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, '/ws/rest/v1/visit/visit-uuid/attribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        attributeType: '6ffc9f6b-a9fb-434e-9b2d-4a2591cc16b3',
        value: 'Ingreso por SAMU sin documentos',
      },
    });
  });

  it('fails closed instead of using the login facility when no emergency location is configured', async () => {
    mockUseConfig.mockReturnValue({
      ...config,
      emergencyLocationUuid: '',
    });
    const { result } = renderHook(() => useEmergencyVisit());
    await expect(result.current.createEmergencyVisit('patient-uuid')).rejects.toMatchObject({
      code: EMERGENCY_LOCATION_UNAVAILABLE,
    });
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(mockShowSnackbar).not.toHaveBeenCalled();
  });

  it('keeps the visit when administrative notes cannot be saved', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { uuid: 'visit-uuid' } } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockRejectedValueOnce(new Error('attribute failure'))
      .mockResolvedValueOnce({ data: { attributes: [] } } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useEmergencyVisit());
    let visitUuid: string | null = null;

    await act(async () => {
      visitUuid = await result.current.createEmergencyVisit(
        'patient-uuid',
        '2026-05-30T10:15:00-05:00',
        'Ingreso por SAMU sin documentos',
      );
    });

    expect(visitUuid).toBe('visit-uuid');
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'warning',
        title: 'Visita creada, observación pendiente',
      }),
    );
  });

  it('fails closed when the active-visit lookup is unavailable', async () => {
    const lookupError = new TypeError('network unavailable');
    mockOpenmrsFetch.mockRejectedValueOnce(lookupError);
    const { result } = renderHook(() => useEmergencyVisit());

    await expect(result.current.getOrCreateEmergencyVisit('patient-uuid')).rejects.toBe(lookupError);

    expect(mockAssertFreshPatientIsAlive).not.toHaveBeenCalled();
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(mockOpenmrsFetch.mock.calls.some(([url, init]) => url === '/ws/rest/v1/visit' && init?.method === 'POST')).toBe(
      false,
    );
  });

  it('fresh-checks a living patient immediately before reusing an active visit', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'active-visit-uuid',
            visitType: { uuid: config.emergencyVisitTypeUuid, display: 'Emergency' },
            startDatetime: '2026-08-12T12:00:00.000Z',
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);
    const { result } = renderHook(() => useEmergencyVisit());

    await expect(result.current.getOrCreateEmergencyVisit('patient-uuid')).resolves.toBe('active-visit-uuid');

    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledWith('patient-uuid');
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
  });

  it('does not reuse an active visit when the patient is deceased', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'active-visit-uuid',
            visitType: { uuid: config.emergencyVisitTypeUuid, display: 'Emergency' },
            startDatetime: '2026-08-12T12:00:00.000Z',
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);
    mockAssertFreshPatientIsAlive.mockRejectedValueOnce(
      Object.assign(new Error('deceased patient'), { code: DECEASED_PATIENT_OPERATION_BLOCKED }),
    );
    const { result } = renderHook(() => useEmergencyVisit());

    await expect(result.current.getOrCreateEmergencyVisit('patient-uuid')).rejects.toMatchObject({
      code: DECEASED_PATIENT_OPERATION_BLOCKED,
    });

    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
  });

  it('does not create a visit when fresh vital status is unavailable after the lookup', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: { results: [] } } as Awaited<ReturnType<typeof openmrsFetch>>);
    mockAssertFreshPatientIsAlive.mockRejectedValueOnce(
      Object.assign(new Error('vital status unavailable'), { code: PATIENT_VITAL_STATUS_UNAVAILABLE }),
    );
    const { result } = renderHook(() => useEmergencyVisit());

    await expect(result.current.getOrCreateEmergencyVisit('patient-uuid')).rejects.toMatchObject({
      code: PATIENT_VITAL_STATUS_UNAVAILABLE,
    });
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(mockOpenmrsFetch.mock.calls.some(([url, init]) => url === '/ws/rest/v1/visit' && init?.method === 'POST')).toBe(
      false,
    );
  });

  it('applies pending administrative notes when a retry recovers an active visit', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              uuid: 'active-visit-uuid',
              visitType: { uuid: config.emergencyVisitTypeUuid, display: 'Emergency' },
              startDatetime: '2026-08-12T12:00:00.000Z',
              attributes: [],
            },
          ],
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce({ data: { uuid: 'notes-attribute-uuid' } } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce({
        data: {
          attributes: [
            {
              uuid: 'notes-attribute-uuid',
              attributeType: { uuid: config.patientRegistration.administrativeNotesVisitAttributeTypeUuid },
              value: 'Ingreso recuperado',
            },
          ],
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>);
    const { result } = renderHook(() => useEmergencyVisit());

    await expect(
      result.current.getOrCreateEmergencyVisit('patient-uuid', undefined, ' Ingreso recuperado '),
    ).resolves.toBe('active-visit-uuid');

    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, '/ws/rest/v1/visit/active-visit-uuid/attribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        attributeType: config.patientRegistration.administrativeNotesVisitAttributeTypeUuid,
        value: 'Ingreso recuperado',
      },
    });
  });

  it('does not duplicate administrative notes already present on a recovered visit', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'active-visit-uuid',
            visitType: { uuid: config.emergencyVisitTypeUuid, display: 'Emergency' },
            startDatetime: '2026-08-12T12:00:00.000Z',
            attributes: [
              {
                uuid: 'notes-attribute-uuid',
                attributeType: { uuid: config.patientRegistration.administrativeNotesVisitAttributeTypeUuid },
                value: 'Ingreso recuperado',
              },
            ],
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);
    const { result } = renderHook(() => useEmergencyVisit());

    await expect(
      result.current.getOrCreateEmergencyVisit('patient-uuid', undefined, 'Ingreso recuperado'),
    ).resolves.toBe('active-visit-uuid');

    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(mockAssertFreshPatientIsAlive).toHaveBeenCalledOnce();
  });

  it('reconciles a lost administrative-note response when the value persisted', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          results: [
            {
              uuid: 'active-visit-uuid',
              visitType: { uuid: config.emergencyVisitTypeUuid, display: 'Emergency' },
              startDatetime: '2026-08-12T12:00:00.000Z',
              attributes: [],
            },
          ],
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockRejectedValueOnce(new TypeError('response lost'))
      .mockResolvedValueOnce({
        data: {
          attributes: [
            {
              uuid: 'notes-attribute-uuid',
              attributeType: { uuid: config.patientRegistration.administrativeNotesVisitAttributeTypeUuid },
              value: 'Ingreso recuperado',
            },
          ],
        },
      } as Awaited<ReturnType<typeof openmrsFetch>>);
    const { result } = renderHook(() => useEmergencyVisit());

    await expect(
      result.current.getOrCreateEmergencyVisit('patient-uuid', undefined, 'Ingreso recuperado'),
    ).resolves.toBe('active-visit-uuid');

    expect(mockShowSnackbar).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Visita creada, observación pendiente' }),
    );
  });

  it.each([
    [
      'deceased',
      Object.assign(new Error('deceased during notes'), { code: DECEASED_PATIENT_OPERATION_BLOCKED }),
    ],
    [
      'vital status unavailable',
      Object.assign(new Error('network unavailable during notes'), { code: PATIENT_VITAL_STATUS_UNAVAILABLE }),
    ],
    ['network failure', new TypeError('network unavailable during notes')],
  ])('does not recover the visit successfully when the notes fresh-check is %s', async (_state, guardError) => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'active-visit-uuid',
            visitType: { uuid: config.emergencyVisitTypeUuid, display: 'Emergency' },
            startDatetime: '2026-08-12T12:00:00.000Z',
            attributes: [],
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);
    mockAssertFreshPatientIsAlive
      .mockResolvedValueOnce({ dead: false, deathDate: null, isDeceased: false })
      .mockRejectedValueOnce(guardError);
    const { result } = renderHook(() => useEmergencyVisit());

    await expect(
      result.current.getOrCreateEmergencyVisit('patient-uuid', undefined, 'Ingreso recuperado'),
    ).rejects.toBe(guardError);

    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Visita creada, observación pendiente' }),
    );
  });

  it('requires a newly created visit response to include a UUID', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: {} } as Awaited<ReturnType<typeof openmrsFetch>>);
    const { result } = renderHook(() => useEmergencyVisit());
    await expect(result.current.createEmergencyVisit('patient-uuid')).rejects.toMatchObject({
      code: EMERGENCY_VISIT_UUID_UNAVAILABLE,
    });
    expect(mockShowSnackbar).not.toHaveBeenCalled();
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(EMERGENCY_VISIT_UUID_UNAVAILABLE).toBe('EMERGENCY_VISIT_UUID_UNAVAILABLE');
  });
});
