import { type FetchResponse, openmrsFetch } from '@openmrs/esm-framework';
import type { ConfigObject } from './config-schema';
import {
  type CreateInterconsultaPayload,
  createInterconsulta,
  respondInterconsulta,
  setInterconsultaFulfillerStatus,
} from './interconsultas.resource';
import { expectKnownGap } from './test-utils/expect-known-gap';
import type { InterconsultaOrder } from './types';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const config: ConfigObject = {
  interconsultaOrderTypeUuid: 'interconsulta-order-type',
  careSettingUuid: 'outpatient-care-setting',
  requestEncounterTypeUuid: 'interconsulta-encounter-type',
  clinicianEncounterRoleUuid: 'clinician-role',
  orderableConceptSets: ['destination-set'],
  concepts: {
    respuestaConceptUuid: 'response-concept',
    recomendacionesConceptUuid: '',
  },
};

const createPayload: CreateInterconsultaPayload = {
  patientUuid: 'patient-uuid',
  visitUuid: 'visit-uuid',
  locationUuid: 'location-uuid',
  providerUuid: 'requester-provider-uuid',
  serviceConceptUuid: 'destination-service-uuid',
  urgency: 'ROUTINE',
  motivo: 'Evaluacion por especialidad',
  config,
};

const order: InterconsultaOrder = {
  uuid: 'order-uuid',
  orderNumber: 'ORD-1',
  action: 'NEW',
  dateActivated: '2026-07-10T14:00:00.000Z',
  dateStopped: null,
  autoExpireDate: null,
  scheduledDate: null,
  urgency: 'ROUTINE',
  instructions: 'Evaluacion por especialidad',
  fulfillerStatus: 'IN_PROGRESS',
  fulfillerComment: null,
  concept: { uuid: 'destination-service-uuid', display: 'Odontologia General' },
  patient: { uuid: 'patient-uuid', display: 'Paciente Prueba' },
  orderer: { uuid: 'requester-provider-uuid', display: 'Profesional Solicitante' },
  encounter: {
    uuid: 'request-encounter-uuid',
    location: { uuid: 'location-uuid', display: 'Consulta externa' },
    visit: { uuid: 'visit-uuid' },
  },
};

function fetchResponse<T>(data: T, status = 200): FetchResponse<T> {
  return { data, ok: status >= 200 && status < 300, status } as FetchResponse<T>;
}

describe('interconsultation mutation contract', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T14:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates an encounter with the patient, visit, location and authenticated provider references', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(fetchResponse({ uuid: 'request-encounter-uuid' }, 201))
      .mockResolvedValueOnce(fetchResponse(order, 201));

    await createInterconsulta(createPayload);

    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      1,
      '/ws/rest/v1/encounter',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          patient: 'patient-uuid',
          visit: 'visit-uuid',
          location: 'location-uuid',
          encounterType: 'interconsulta-encounter-type',
          encounterProviders: [
            {
              provider: 'requester-provider-uuid',
              encounterRole: 'clinician-role',
            },
          ],
        }),
      }),
    );
  });

  it('creates the order with the configured order type, destination and clinical reason', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(fetchResponse({ uuid: 'request-encounter-uuid' }, 201))
      .mockResolvedValueOnce(fetchResponse(order, 201));

    await createInterconsulta(createPayload);

    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      '/ws/rest/v1/order',
      expect.objectContaining({
        method: 'POST',
        body: {
          action: 'NEW',
          type: 'order',
          patient: 'patient-uuid',
          careSetting: 'outpatient-care-setting',
          orderer: 'requester-provider-uuid',
          encounter: 'request-encounter-uuid',
          concept: 'destination-service-uuid',
          orderType: 'interconsulta-order-type',
          urgency: 'ROUTINE',
          instructions: 'Evaluacion por especialidad',
        },
      }),
    );
  });

  it('only persists scheduledDate for a scheduled request', async () => {
    const scheduledDate = new Date('2026-07-15T15:00:00.000Z');
    mockOpenmrsFetch
      .mockResolvedValueOnce(fetchResponse({ uuid: 'request-encounter-uuid' }, 201))
      .mockResolvedValueOnce(fetchResponse(order, 201));

    await createInterconsulta({
      ...createPayload,
      urgency: 'ON_SCHEDULED_DATE',
      scheduledDate,
    });

    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      '/ws/rest/v1/order',
      expect.objectContaining({
        body: expect.objectContaining({
          urgency: 'ON_SCHEDULED_DATE',
          scheduledDate: expect.stringContaining('2026-07-15'),
        }),
      }),
    );
  });

  it('does not attempt to create an order when encounter creation fails', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(new Error('encounter failed'));

    await expect(createInterconsulta(createPayload)).rejects.toThrow('encounter failed');

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('updates fulfiller details and caps the management comment at 1024 characters', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce(fetchResponse(undefined));

    await setInterconsultaFulfillerStatus('order-uuid', 'DECLINED', 'x'.repeat(1100));

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      '/ws/rest/v1/order/order-uuid/fulfillerdetails/',
      expect.objectContaining({
        method: 'POST',
        body: {
          fulfillerStatus: 'DECLINED',
          fulfillerComment: 'x'.repeat(1024),
        },
      }),
    );
  });

  it('links the response observation to the order before marking it completed', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(fetchResponse({ uuid: 'request-encounter-uuid' }))
      .mockResolvedValueOnce(fetchResponse(undefined));

    await respondInterconsulta({
      order,
      respuesta: 'Paciente evaluado',
      recomendaciones: 'Control en 30 dias',
      respuestaConceptUuid: 'response-concept',
    });

    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      1,
      '/ws/rest/v1/encounter/request-encounter-uuid',
      expect.objectContaining({
        method: 'POST',
        body: {
          obs: [
            {
              concept: 'response-concept',
              value: 'Paciente evaluado\n\nRecomendaciones: Control en 30 dias',
              order: { uuid: 'order-uuid' },
            },
          ],
        },
      }),
    );
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
      2,
      '/ws/rest/v1/order/order-uuid/fulfillerdetails/',
      expect.objectContaining({
        body: {
          fulfillerStatus: 'COMPLETED',
          fulfillerComment: 'Paciente evaluado',
        },
      }),
    );
  });

  it('does not complete the order when saving the response fails', async () => {
    mockOpenmrsFetch.mockRejectedValueOnce(new Error('response failed'));

    await expect(
      respondInterconsulta({
        order,
        respuesta: 'Paciente evaluado',
        respuestaConceptUuid: 'response-concept',
      }),
    ).rejects.toThrow('response failed');

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('surfaces completion failure after the response has already been persisted', async () => {
    mockOpenmrsFetch
      .mockResolvedValueOnce(fetchResponse({ uuid: 'request-encounter-uuid' }))
      .mockRejectedValueOnce(new Error('completion failed'));

    await expect(
      respondInterconsulta({
        order,
        respuesta: 'Paciente evaluado',
        respuestaConceptUuid: 'response-concept',
      }),
    ).rejects.toThrow('completion failed');

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
  });

  it('[AC-01][brecha] persists the request encounter and order atomically', async () => {
    await expectKnownGap(async () => {
      mockOpenmrsFetch
        .mockResolvedValueOnce(fetchResponse({ uuid: 'request-encounter-uuid' }, 201))
        .mockResolvedValueOnce(fetchResponse(order, 201));

      await createInterconsulta(createPayload);

      expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        '/ws/rest/v1/encounter',
        expect.objectContaining({
          body: expect.objectContaining({
            orders: [expect.objectContaining({ orderType: 'interconsulta-order-type' })],
          }),
        }),
      );
    });
  });

  it('[AC-04][brecha] records the response in a new encounter owned by the responder', async () => {
    await expectKnownGap(async () => {
      mockOpenmrsFetch
        .mockResolvedValueOnce(fetchResponse({ uuid: 'response-encounter-uuid' }, 201))
        .mockResolvedValueOnce(fetchResponse(undefined));

      await respondInterconsulta({
        order,
        respuesta: 'Paciente evaluado',
        respuestaConceptUuid: 'response-concept',
      });

      expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(
        1,
        '/ws/rest/v1/encounter',
        expect.objectContaining({
          body: expect.objectContaining({
            encounterDatetime: expect.any(String),
            encounterProviders: expect.any(Array),
            obs: [expect.objectContaining({ order: { uuid: 'order-uuid' } })],
          }),
        }),
      );
    });
  });
});
