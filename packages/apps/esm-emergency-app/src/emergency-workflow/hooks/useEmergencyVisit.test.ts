import { getDefaultsFromConfigSchema, openmrsFetch, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { act, renderHook } from '@testing-library/react';
import { type Config, configSchema } from '../../config-schema';
import { useEmergencyVisit } from './useEmergencyVisit';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseConfig = vi.mocked(useConfig<Config>);

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
  });

  it('creates an emergency visit at the provided arrival time and stores administrative notes as a visit attribute', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { uuid: 'visit-uuid' } } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce({ data: { uuid: 'visit-attribute-uuid' } } as Awaited<ReturnType<typeof openmrsFetch>>);

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
    let visitUuid: string | null = 'not-null';

    await act(async () => {
      visitUuid = await result.current.createEmergencyVisit('patient-uuid');
    });

    expect(visitUuid).toBeNull();
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'error',
      subtitle: 'No se configuró la ubicación operativa de emergencia.',
      title: 'Error al crear visita',
    });
  });

  it('keeps the visit when administrative notes cannot be saved', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { uuid: 'visit-uuid' } } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockRejectedValueOnce(new Error('attribute failure'));

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
});
