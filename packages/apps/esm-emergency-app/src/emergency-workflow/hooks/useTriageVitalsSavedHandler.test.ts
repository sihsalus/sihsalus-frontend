import { getDefaultsFromConfigSchema, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { act, renderHook } from '@testing-library/react';

import { type Config, configSchema } from '../../config-schema';
import { useEmergencyConfig } from '../../hooks/usePriorityConfig';
import { type EmergencyQueueEntry, transitionToAttentionQueue } from '../../resources/emergency.resource';
import { useTriageVitalsSavedHandler } from './useTriageVitalsSavedHandler';

const mockMutate = vi.fn();

vi.mock('swr', async () => ({
  ...(await vi.importActual('swr')),
  useSWRConfig: () => ({ mutate: mockMutate }),
}));

vi.mock('../../hooks/usePriorityConfig', async () => ({
  ...(await vi.importActual('../../hooks/usePriorityConfig')),
  useEmergencyConfig: vi.fn(),
}));

vi.mock('../../resources/emergency.resource', async () => ({
  ...(await vi.importActual('../../resources/emergency.resource')),
  transitionToAttentionQueue: vi.fn(),
}));

const mockShowSnackbar = vi.mocked(showSnackbar);
const mockTransitionToAttentionQueue = vi.mocked(transitionToAttentionQueue);
const mockUseConfig = vi.mocked(useConfig<Config>);
const mockUseEmergencyConfig = vi.mocked(useEmergencyConfig);

const queueEntry = {
  uuid: 'queue-entry-uuid',
  patient: { uuid: 'patient-uuid' },
  queue: { uuid: 'triage-queue-uuid' },
} as EmergencyQueueEntry;

describe('useTriageVitalsSavedHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema) as Config);
    mockUseEmergencyConfig.mockReturnValue({
      emergencyAttentionQueueUuid: 'attention-queue-uuid',
      queueStatuses: { waiting: 'waiting-status-uuid', inService: 'in-service-status-uuid' },
    } as ReturnType<typeof useEmergencyConfig>);
  });

  it('passes the exact source and target context and refreshes the queue after confirmation', async () => {
    mockTransitionToAttentionQueue.mockResolvedValue({ data: { uuid: 'attention-entry-uuid' } } as Awaited<
      ReturnType<typeof transitionToAttentionQueue>
    >);
    const { result } = renderHook(() => useTriageVitalsSavedHandler(queueEntry));

    await act(async () => {
      await result.current({
        visitUuid: 'visit-uuid',
        formData: {
          respiratoryRate: 20,
          oxygenSaturation: 98,
          systolicBloodPressure: 120,
          pulse: 80,
          temperature: 37,
          glasgowTotal: 15,
        },
      });
    });

    expect(mockTransitionToAttentionQueue).toHaveBeenCalledWith({
      sourceQueueEntryUuid: 'queue-entry-uuid',
      patientUuid: 'patient-uuid',
      visitUuid: 'visit-uuid',
      sourceQueueUuid: 'triage-queue-uuid',
      sourceStatusUuid: 'in-service-status-uuid',
      targetQueueUuid: 'attention-queue-uuid',
      targetStatusUuid: 'waiting-status-uuid',
      targetPriorityUuid: expect.any(String),
    });
    expect(mockMutate).toHaveBeenCalledWith(expect.any(Function));
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', title: 'Triaje completado' }),
    );
  });

  it('does not transition when the saved vitals are incomplete', async () => {
    const { result } = renderHook(() => useTriageVitalsSavedHandler(queueEntry));

    await act(async () => {
      await result.current({ visitUuid: 'visit-uuid', formData: { pulse: 80 } });
    });

    expect(mockTransitionToAttentionQueue).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'warning', title: 'Triaje incompleto' }),
    );
  });

  it('does not transition without the exact visit saved by the vitals form', async () => {
    const { result } = renderHook(() => useTriageVitalsSavedHandler(queueEntry));

    await act(async () => {
      await result.current({
        visitUuid: '',
        formData: {
          respiratoryRate: 20,
          oxygenSaturation: 98,
          systolicBloodPressure: 120,
          pulse: 80,
          temperature: 37,
          glasgowTotal: 15,
        },
      });
    });

    expect(mockTransitionToAttentionQueue).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'error', title: 'No se encontró una visita activa' }),
    );
  });

  it('does not expose backend details when the post-vitals transition is ambiguous', async () => {
    mockTransitionToAttentionQueue.mockRejectedValue(
      new Error('POST /ws/rest/v1/queue-entry/transition failed with SQLSTATE 40001'),
    );
    const { result } = renderHook(() => useTriageVitalsSavedHandler(queueEntry));

    await act(async () => {
      await result.current({
        visitUuid: 'visit-uuid',
        formData: {
          respiratoryRate: 20,
          oxygenSaturation: 98,
          systolicBloodPressure: 120,
          pulse: 80,
          temperature: 37,
          glasgowTotal: 15,
        },
      });
    });

    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'error',
      subtitle:
        'Los signos vitales fueron guardados, pero no se pudo confirmar el envío a atención. No vuelva a guardar los signos ni repita el triaje; revise la cola.',
      title: 'Error al completar triaje',
    });
    expect(mockShowSnackbar.mock.calls.flatMap(([message]) => message.subtitle ?? []).join(' ')).not.toMatch(
      /SQLSTATE|\/ws\/rest/u,
    );
  });
});
