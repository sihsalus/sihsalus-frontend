import {
  type FetchResponse,
  omrsOfflineCachingStrategyHttpHeaderName,
  openmrsFetch,
  restBaseUrl,
  type Visit,
} from '@openmrs/esm-framework';
import { assertFreshPatientIsAlive } from '@openmrs/esm-patient-common-lib';

import { type ConfigObject } from '../config-schema';
import { fetchQueueEntry, transitionQueueEntry } from '../modals/queue-entry-actions.resource';
import { type QueueEntry } from '../types';
import { getObstetricCareMode, type ObstetricCareMode, startObstetricCare } from './obstetric-care.resource';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  omrsOfflineCachingStrategyHttpHeaderName: 'x-omrs-offline-caching-strategy',
}));
vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  assertFreshPatientIsAlive: vi.fn(),
}));
vi.mock('../modals/queue-entry-actions.resource', () => ({
  fetchQueueEntry: vi.fn(),
  transitionQueueEntry: vi.fn(),
}));

const obstetricCare = {
  enabled: true,
  outpatientAppointmentServiceUuid: 'obstetric-service',
  outpatientQueueUuid: 'outpatient-queue',
  inpatientQueueUuid: 'inpatient-queue',
};

function response<T>(data: T): FetchResponse<T> {
  return { data } as FetchResponse<T>;
}

function makeQueueEntry(mode: ObstetricCareMode = 'outpatient'): QueueEntry {
  return {
    uuid: 'queue-entry',
    patient: { uuid: 'patient' },
    visit: { uuid: 'visit' },
    queue: {
      uuid: mode === 'outpatient' ? obstetricCare.outpatientQueueUuid : obstetricCare.inpatientQueueUuid,
      allowedStatuses: [{ uuid: 'in-service' }],
    },
    priority: { uuid: 'urgent-priority' },
    priorityComment: 'Synthetic queue comment',
    status: { uuid: 'waiting' },
    endedAt: null,
    workflow: { appointmentServiceUuid: obstetricCare.outpatientAppointmentServiceUuid },
  } as unknown as QueueEntry;
}

let config: ConfigObject;
let entry: QueueEntry;
let freshEntry: QueueEntry;
let visit: Visit;
let activeVisits: {
  results: Array<Pick<Visit, 'uuid' | 'patient' | 'stopDatetime'>>;
  links?: Array<{ rel: string }>;
};
let appointment: {
  uuid: string;
  patient: { uuid: string };
  service: { uuid: string };
  location: { uuid: string };
};

beforeEach(() => {
  vi.resetAllMocks();
  config = {
    obstetricCare: { ...obstetricCare },
    concepts: {
      defaultStatusConceptUuid: 'waiting',
      finishedServiceStatusConceptUuid: 'triage-finished',
      defaultTransitionStatus: 'in-service',
    },
    appointmentTriage: {
      appointmentVisitAttributeTypeUuid: 'appointment-attribute',
      triageRouting: { enabled: true, encounterTypeUuid: 'triage-encounter-type' },
      appointmentArrivalRules: [
        {
          appointmentServiceUuid: obstetricCare.outpatientAppointmentServiceUuid,
          appointmentLocationUuid: 'outpatient-location',
          queueUuid: obstetricCare.outpatientQueueUuid,
        },
      ],
    },
  } as ConfigObject;
  entry = makeQueueEntry();
  freshEntry = { ...entry };
  visit = {
    uuid: 'visit',
    patient: { uuid: 'patient' },
    location: { uuid: 'outpatient-location' },
    stopDatetime: null,
    voided: false,
    attributes: [{ uuid: 'visit-attribute', attributeType: { uuid: 'appointment-attribute' }, value: 'appointment' }],
    encounters: [{ uuid: 'triage', encounterType: { uuid: 'triage-encounter-type' }, voided: false }],
  } as unknown as Visit;
  activeVisits = { results: [visit] };
  appointment = {
    uuid: 'appointment',
    patient: { uuid: 'patient' },
    service: { uuid: obstetricCare.outpatientAppointmentServiceUuid },
    location: { uuid: 'outpatient-location' },
  };
  vi.mocked(fetchQueueEntry).mockImplementation(async () => response(freshEntry));
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    const { pathname } = new URL(String(url), 'https://example.test');
    if (pathname === `${restBaseUrl}/visit`) {
      return response(activeVisits);
    }
    if (pathname === `${restBaseUrl}/visit/visit`) {
      return response(visit);
    }
    if (pathname === `${restBaseUrl}/appointments/appointment`) {
      return response(appointment);
    }
    throw new Error('Unexpected clinical request');
  });
  vi.mocked(assertFreshPatientIsAlive).mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
  vi.mocked(transitionQueueEntry).mockImplementation(async () =>
    response({ ...freshEntry, uuid: 'attending-entry', endedAt: null, status: { uuid: 'in-service' } } as QueueEntry),
  );
});

describe('getObstetricCareMode', () => {
  it.each<ObstetricCareMode>(['outpatient', 'inpatient'])('recognizes the configured %s circuit', (mode) => {
    expect(getObstetricCareMode(makeQueueEntry(mode), obstetricCare)).toBe(mode);
  });

  it('does not infer obstetric care from a queue name or an unlinked appointment', () => {
    const withoutLinkedService = { ...entry, workflow: undefined };
    expect(getObstetricCareMode(withoutLinkedService, obstetricCare)).toBeNull();
    expect(
      getObstetricCareMode(
        { ...entry, queue: { ...entry.queue, uuid: 'other-queue', name: 'Obstetricia' } },
        obstetricCare,
      ),
    ).toBeNull();
  });

  it.each([
    { enabled: false },
    { outpatientAppointmentServiceUuid: '' },
    { inpatientQueueUuid: ' ' },
    { inpatientQueueUuid: obstetricCare.outpatientQueueUuid },
  ])('fails closed for disabled, incomplete or ambiguous settings: %j', (settings) => {
    expect(getObstetricCareMode(entry, { ...obstetricCare, ...settings })).toBeNull();
  });
});

describe('startObstetricCare', () => {
  it.each<ObstetricCareMode>(['outpatient', 'inpatient'])('starts %s care without changing its queue', async (mode) => {
    entry = makeQueueEntry(mode);
    freshEntry = { ...entry };
    if (mode === 'inpatient') {
      visit = { ...visit, attributes: [], encounters: [] };
      config.appointmentTriage.triageRouting.enabled = false;
    }

    await expect(startObstetricCare(entry, mode, config)).resolves.toMatchObject({
      uuid: 'attending-entry',
      visit: { uuid: visit.uuid, stopDatetime: null },
    });
    expect(transitionQueueEntry).toHaveBeenCalledExactlyOnceWith({
      queueEntryToTransition: entry.uuid,
      newQueue: entry.queue.uuid,
      newStatus: 'in-service',
    });
    expect(openmrsFetch).toHaveBeenCalledWith(expect.stringContaining(`${restBaseUrl}/visit/visit?v=full&_=`), {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
        [omrsOfflineCachingStrategyHttpHeaderName]: 'network-only-or-cache-only',
      },
    });
    expect(openmrsFetch).toHaveBeenCalledTimes(mode === 'outpatient' ? 3 : 2);
  });

  it('opens care already in service without creating another queue entry', async () => {
    freshEntry = { ...freshEntry, status: { ...freshEntry.status, uuid: 'in-service' } };

    await expect(startObstetricCare(entry, 'outpatient', config)).resolves.toMatchObject({ uuid: entry.uuid });
    expect(assertFreshPatientIsAlive).toHaveBeenCalledExactlyOnceWith('patient');
    expect(transitionQueueEntry).not.toHaveBeenCalled();
  });

  it('preserves a priority corrected while the visit is being verified', async () => {
    const read = vi.mocked(openmrsFetch).getMockImplementation();
    vi.mocked(openmrsFetch).mockImplementation(async (...args) => {
      freshEntry = { ...freshEntry, priority: { ...freshEntry.priority, uuid: 'corrected-priority' } };
      return read(...args);
    });

    await expect(startObstetricCare(entry, 'outpatient', config)).resolves.toMatchObject({
      priority: { uuid: 'corrected-priority' },
    });
    expect(vi.mocked(transitionQueueEntry).mock.calls[0][0]).not.toHaveProperty('newPriority');
  });

  it('still blocks a deceased patient when reopening care already in service', async () => {
    freshEntry = { ...freshEntry, status: { ...freshEntry.status, uuid: 'in-service' } };
    const error = new Error('Deceased patient');
    vi.mocked(assertFreshPatientIsAlive).mockRejectedValue(error);

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toBe(error);
    expect(transitionQueueEntry).not.toHaveBeenCalled();
  });

  it.each(['uuid', 'patient', 'visit', 'queue'] as const)('rejects a stale %s identity', async (field) => {
    freshEntry = { ...freshEntry, [field]: field === 'uuid' ? 'other-entry' : { uuid: 'other-subject' } };

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toThrow('The obstetric queue entry changed');
    expect(openmrsFetch).not.toHaveBeenCalled();
    expect(transitionQueueEntry).not.toHaveBeenCalled();
  });

  it.each([
    { stopDatetime: '2026-09-14T14:00:00.000Z' },
    { stopDatetime: undefined },
    { voided: true },
    { auditInfo: { voided: true } },
    { uuid: 'another-visit' },
    { patient: { uuid: 'another-patient' } },
  ])('rejects a closed, voided or mismatched visit: %j', async (change) => {
    visit = { ...visit, ...change } as Visit;

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toThrow(
      'The active obstetric visit could not be verified.',
    );
    expect(openmrsFetch).toHaveBeenCalledTimes(1);
    expect(transitionQueueEntry).not.toHaveBeenCalled();
  });

  it.each(['uuid', 'patient', 'service', 'location'] as const)('revalidates the appointment %s', async (field) => {
    appointment = { ...appointment, [field]: field === 'uuid' ? 'other-appointment' : { uuid: 'other-context' } };

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toThrow(
      'The obstetric appointment route or saved triage could not be verified.',
    );
    expect(openmrsFetch).toHaveBeenCalledTimes(3);
    expect(transitionQueueEntry).not.toHaveBeenCalled();
  });

  it.each(['none', 'other', 'multiple', 'paginated'] as const)('rejects %s active visit results', async (state) => {
    if (state === 'none') {
      activeVisits.results = [];
    } else if (state === 'other') {
      activeVisits.results = [{ ...visit, uuid: 'another-active-visit' }];
    } else if (state === 'multiple') {
      activeVisits.results = [visit, { ...visit, uuid: 'another-active-visit' }];
    } else {
      activeVisits.links = [{ rel: 'next' }];
    }

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toThrow(
      'A unique active obstetric visit could not be verified.',
    );
    expect(openmrsFetch).toHaveBeenCalledTimes(2);
    expect(transitionQueueEntry).not.toHaveBeenCalled();
  });

  it('fails closed when the active visit list cannot be refreshed', async () => {
    const error = new Error('Active visits unavailable');
    vi.mocked(openmrsFetch).mockResolvedValueOnce(response(visit)).mockRejectedValueOnce(error);

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toBe(error);
    expect(openmrsFetch).toHaveBeenCalledTimes(2);
    expect(transitionQueueEntry).not.toHaveBeenCalled();
  });

  it.each(['missing', 'voided', 'ambiguous'] as const)('rejects a %s persisted appointment link', async (state) => {
    const attribute = visit.attributes[0];
    visit.attributes =
      state === 'missing' ? [] : state === 'voided' ? [{ ...attribute, voided: true }] : [attribute, attribute];

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toThrow(
      'The linked obstetric appointment and triage could not be verified.',
    );
    expect(openmrsFetch).toHaveBeenCalledTimes(2);
    expect(transitionQueueEntry).not.toHaveBeenCalled();
  });

  it.each([
    'pending',
    'voided',
    'wrong-type',
  ] as const)('requires confirmed triage and rejects %s encounters', async (state) => {
    visit.encounters =
      state === 'pending'
        ? []
        : [
            {
              ...visit.encounters[0],
              voided: state === 'voided',
              encounterType: { uuid: state === 'wrong-type' ? 'another-encounter-type' : 'triage-encounter-type' },
            },
          ];

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toThrow(
      'The obstetric appointment route or saved triage could not be verified.',
    );
    expect(openmrsFetch).toHaveBeenCalledTimes(3);
    expect(transitionQueueEntry).not.toHaveBeenCalled();
  });

  it.each(['missing', 'ambiguous', 'wrong-queue'] as const)('rejects a %s outpatient arrival route', async (state) => {
    const route = config.appointmentTriage.appointmentArrivalRules[0];
    config.appointmentTriage.appointmentArrivalRules =
      state === 'missing' ? [] : state === 'ambiguous' ? [route, route] : [{ ...route, queueUuid: 'other-queue' }];

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toThrow(
      'The obstetric appointment route or saved triage could not be verified.',
    );
    expect(openmrsFetch).toHaveBeenCalledTimes(3);
    expect(transitionQueueEntry).not.toHaveBeenCalled();
  });

  it('rejects an absent transition concept before any request', async () => {
    config.concepts.defaultTransitionStatus = '';

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toThrow(
      'The obstetric queue configuration could not be verified.',
    );
    expect(fetchQueueEntry).not.toHaveBeenCalled();
  });

  it.each(['disabled', 'missing-type'] as const)('rejects %s outpatient triage configuration', async (state) => {
    config.appointmentTriage.triageRouting.enabled = state !== 'disabled';
    if (state === 'missing-type') {
      config.appointmentTriage.triageRouting.encounterTypeUuid = '';
    }

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toThrow(
      'The linked obstetric appointment and triage could not be verified.',
    );
    expect(openmrsFetch).toHaveBeenCalledTimes(2);
    expect(transitionQueueEntry).not.toHaveBeenCalled();
  });

  it('rejects an in-service status excluded by the queue configuration', async () => {
    freshEntry = { ...freshEntry, queue: { ...freshEntry.queue, allowedStatuses: [] } };

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toThrow('The obstetric queue entry changed');
    expect(openmrsFetch).not.toHaveBeenCalled();
    expect(transitionQueueEntry).not.toHaveBeenCalled();
  });

  it('accepts the completed-triage status used by the outpatient routing contract', async () => {
    freshEntry = { ...freshEntry, status: { ...freshEntry.status, uuid: 'triage-finished' } };

    await expect(startObstetricCare(entry, 'outpatient', config)).resolves.toMatchObject({ uuid: 'attending-entry' });
  });

  it('does not reactivate an entry in an unknown or cancelled status', async () => {
    freshEntry = { ...freshEntry, status: { ...freshEntry.status, uuid: 'cancelled' } };

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toThrow('The obstetric queue entry changed');
    expect(openmrsFetch).not.toHaveBeenCalled();
    expect(transitionQueueEntry).not.toHaveBeenCalled();
  });

  it('rejects ambiguous source and in-service concepts', async () => {
    config.concepts.defaultStatusConceptUuid = config.concepts.defaultTransitionStatus;

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toThrow(
      'The obstetric queue configuration could not be verified.',
    );
    expect(fetchQueueEntry).not.toHaveBeenCalled();
  });

  it('delegates a retry on a closed source to transition reconciliation', async () => {
    freshEntry = { ...freshEntry, endedAt: '2026-09-14T14:00:00.000Z' };

    await expect(startObstetricCare(entry, 'outpatient', config)).resolves.toMatchObject({ uuid: 'attending-entry' });
    expect(transitionQueueEntry).toHaveBeenCalledTimes(1);
  });

  it('does not reopen a closed in-service entry', async () => {
    freshEntry = {
      ...freshEntry,
      endedAt: '2026-09-14T14:00:00.000Z',
      status: { ...freshEntry.status, uuid: 'in-service' },
    };

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toThrow('The obstetric queue entry changed');
    expect(openmrsFetch).not.toHaveBeenCalled();
    expect(transitionQueueEntry).not.toHaveBeenCalled();
  });

  it.each([
    { endedAt: '2026-09-14T15:00:00.000Z' },
    { patient: { uuid: 'other-patient' } },
    { visit: { uuid: 'other-visit' } },
    { queue: { uuid: 'other-queue' } },
    { status: { uuid: 'waiting' } },
  ])('does not open a closed or mismatched transition successor: %j', async (change) => {
    vi.mocked(transitionQueueEntry).mockResolvedValue(
      response({
        ...freshEntry,
        uuid: 'attending-entry',
        status: { uuid: 'in-service' },
        ...change,
      } as QueueEntry),
    );

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toThrow(
      'The active obstetric queue transition could not be verified.',
    );
    expect(transitionQueueEntry).toHaveBeenCalledTimes(1);
  });

  it('propagates failed authoritative reads without transitioning', async () => {
    const error = new Error('Network unavailable');
    vi.mocked(openmrsFetch).mockRejectedValue(error);

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toBe(error);
    expect(transitionQueueEntry).not.toHaveBeenCalled();
  });

  it('does not return care when the transition could not be confirmed', async () => {
    const error = new Error('Transition rejected');
    vi.mocked(transitionQueueEntry).mockRejectedValue(error);

    await expect(startObstetricCare(entry, 'outpatient', config)).rejects.toBe(error);
  });
});
