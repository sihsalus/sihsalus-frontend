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

  const verifiedVisitData = {
    uuid: 'visit-uuid',
    voided: false,
    stopDatetime: null,
    patient: { uuid: 'patient-uuid' },
    visitType: { uuid: '11111111-1111-4111-8111-111111111111' },
    location: { uuid: '22222222-2222-4222-8222-222222222222' },
  };
  const verifiedVisitResponse = { data: verifiedVisitData } as Awaited<ReturnType<typeof openmrsFetch>>;

  it('creates an emergency visit at the provided arrival time and stores administrative notes as a visit attribute', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { uuid: 'visit-uuid' } } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce(verifiedVisitResponse)
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
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/visit/visit-uuid?v='));
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(3, '/ws/rest/v1/visit/visit-uuid/attribute', {
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
      .mockResolvedValueOnce(verifiedVisitResponse)
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

  it('does not reuse an active visit of another type for emergency care', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'outpatient-visit-uuid',
            voided: false,
            patient: { uuid: 'patient-uuid' },
            visitType: { uuid: 'outpatient-visit-type-uuid', display: 'Consulta externa' },
            startDatetime: '2026-07-15T10:00:00.000Z',
            stopDatetime: null,
            location: { uuid: '33333333-3333-4333-8333-333333333333', display: 'Emergencia' },
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useEmergencyVisit());
    let visitUuid: string | null = 'unexpected';
    await act(async () => {
      visitUuid = await result.current.getOrCreateEmergencyVisit('patient-uuid');
    });

    expect(visitUuid).toBeNull();
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'error',
      subtitle:
        'El paciente tiene una visita activa de otro tipo. No se reutilizó ni se creó otra visita; revise el episodio antes de continuar.',
      title: 'La visita activa requiere revisión',
    });
  });

  it('fails closed when multiple emergency visits are active', async () => {
    const emergencyVisit = {
      uuid: 'emergency-visit-one',
      voided: false,
      patient: { uuid: 'patient-uuid' },
      visitType: { uuid: config.emergencyVisitTypeUuid, display: 'Emergencia' },
      startDatetime: '2026-07-15T10:00:00.000Z',
      stopDatetime: null,
      location: { uuid: '33333333-3333-4333-8333-333333333333', display: 'Emergencia' },
    };
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: { results: [emergencyVisit, { ...emergencyVisit, uuid: 'emergency-visit-two' }] },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useEmergencyVisit());
    let visitUuid: string | null = 'unexpected';
    await act(async () => {
      visitUuid = await result.current.getOrCreateEmergencyVisit('patient-uuid');
    });

    expect(visitUuid).toBeNull();
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle:
          'Se encontraron varias visitas de emergencia activas. No se creó otra; concilie los episodios antes de continuar.',
      }),
    );
  });

  it('reuses only an active emergency visit whose patient, type and location are reverified', async () => {
    const emergencyVisit = {
      uuid: 'emergency-visit-uuid',
      voided: false,
      patient: { uuid: 'patient-uuid' },
      visitType: { uuid: config.emergencyVisitTypeUuid, display: 'Emergencia' },
      startDatetime: '2026-07-15T10:00:00.000Z',
      stopDatetime: null,
      location: { uuid: '22222222-2222-4222-8222-222222222222', display: 'Emergencia' },
    };
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: [emergencyVisit] } } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce({ data: { ...verifiedVisitData, uuid: emergencyVisit.uuid } } as Awaited<
        ReturnType<typeof openmrsFetch>
      >);

    const { result } = renderHook(() => useEmergencyVisit());
    let visitUuid: string | null = null;
    await act(async () => {
      visitUuid = await result.current.getOrCreateEmergencyVisit('patient-uuid');
    });

    expect(visitUuid).toBe('emergency-visit-uuid');
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, expect.stringContaining('/visit/emergency-visit-uuid?v='));
  });

  it('does not reuse or create when the active emergency visit belongs to another location', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'other-location-visit-uuid',
            voided: false,
            patient: { uuid: 'patient-uuid' },
            visitType: { uuid: config.emergencyVisitTypeUuid, display: 'Emergencia' },
            startDatetime: '2026-07-15T10:00:00.000Z',
            stopDatetime: null,
            location: { uuid: 'different-location-uuid', display: 'Otra sede' },
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useEmergencyVisit());
    let visitUuid: string | null = 'unexpected';
    await act(async () => {
      visitUuid = await result.current.getOrCreateEmergencyVisit('patient-uuid');
    });

    expect(visitUuid).toBeNull();
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'error',
      subtitle:
        'La visita de emergencia activa pertenece a otra sede. No se reutilizó ni se creó otra visita; revise el episodio y la sede antes de continuar.',
      title: 'La visita activa requiere revisión',
    });
  });

  it('does not continue when the returned visit identity does not match the patient', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { uuid: 'visit-uuid' } } as Awaited<ReturnType<typeof openmrsFetch>>)
      .mockResolvedValueOnce({
        ...verifiedVisitResponse,
        data: { ...verifiedVisitData, patient: { uuid: 'different-patient' } },
      } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useEmergencyVisit());
    let visitUuid: string | null = 'unexpected';
    await act(async () => {
      visitUuid = await result.current.createEmergencyVisit('patient-uuid', undefined, 'Observación');
    });

    expect(visitUuid).toBeNull();
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockShowSnackbar).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle:
          'No se pudo confirmar la creación de la visita de emergencia. Verifique las visitas activas antes de reintentar.',
      }),
    );
  });

  it('does not create a visit when the active-visit lookup fails', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(new Error('GET /ws/rest/v1/visit failed with SQLSTATE 42P01'));

    const { result } = renderHook(() => useEmergencyVisit());
    let visitUuid: string | null = 'unexpected';

    await act(async () => {
      visitUuid = await result.current.getOrCreateEmergencyVisit('patient-uuid');
    });

    expect(visitUuid).toBeNull();
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'error',
      subtitle:
        'No se creó una visita nueva porque no se pudo comprobar si el paciente ya tiene una visita activa. Actualice e intente nuevamente.',
      title: 'No se pudo verificar la visita activa',
    });
    expect(mockShowSnackbar.mock.calls.flatMap(([message]) => message.subtitle ?? []).join(' ')).not.toMatch(
      /SQLSTATE|\/ws\/rest/u,
    );
  });

  it('fails closed when the active-visit lookup response is malformed', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: {} } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useEmergencyVisit());
    let visitUuid: string | null = 'unexpected';

    await act(async () => {
      visitUuid = await result.current.getOrCreateEmergencyVisit('patient-uuid');
    });

    expect(visitUuid).toBeNull();
    expect(mockOpenmrsFetch).toHaveBeenCalledOnce();
    expect(mockShowSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' }));
  });

  it('does not expose backend details when visit creation fails', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(
      Object.assign(new Error('POST /ws/rest/v1/visit failed with SQLSTATE 23505'), {
        responseBody: { error: { message: 'duplicate key SQLSTATE 23505' } },
      }),
    );

    const { result } = renderHook(() => useEmergencyVisit());
    let visitUuid: string | null = 'unexpected';

    await act(async () => {
      visitUuid = await result.current.createEmergencyVisit('patient-uuid');
    });

    expect(visitUuid).toBeNull();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'error',
      subtitle:
        'No se pudo confirmar la creación de la visita de emergencia. Verifique las visitas activas antes de reintentar.',
      title: 'Error al crear visita',
    });
    expect(mockShowSnackbar.mock.calls.flatMap(([message]) => message.subtitle ?? []).join(' ')).not.toMatch(
      /SQLSTATE|23505|\/ws\/rest/u,
    );
  });
});
