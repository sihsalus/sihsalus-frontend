import { getDefaultsFromConfigSchema, openmrsFetch } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';

import { type ActiveVisitsConfigSchema, configSchema } from '../config-schema';
import {
  filterPendingSisVisits,
  type RestActiveVisit,
  usePendingSisAccreditations,
} from './pending-sis-accreditations.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const config = (getDefaultsFromConfigSchema(configSchema) as ActiveVisitsConfigSchema).pendingSisAccreditations;

const financiadorAttributeTypeUuid = config.financiadorVisitAttributeTypeUuid;
const statusAttributeTypeUuid = config.accreditationStatusVisitAttributeTypeUuid;
const sisConceptUuid = '97c6e901-7570-4ab8-a9c0-9cf2b0f5bc0c';
const legacySisGratuitoConceptUuid = 'b61a9ff9-1485-4388-9f67-9c341f847f85';
const essaludConceptUuid = 'essalud-concept-uuid';
const activeStatusConceptUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db2051';
const inactiveStatusConceptUuid = '9b3df0a1-0c58-4f55-9868-9c38f1db2052';

let visitCounter = 0;

function buildVisit({
  financiador,
  status,
  startDatetime = '2026-07-17T08:00:00.000-0500',
  identifiers = [
    {
      identifier: '79000001',
      identifierType: { uuid: config.dniIdentifierTypeUuid, display: 'DNI' },
    },
  ],
}: {
  financiador?: string | { uuid?: string };
  status?: string | { uuid?: string };
  startDatetime?: string;
  identifiers?: NonNullable<RestActiveVisit['patient']>['identifiers'];
}): RestActiveVisit {
  visitCounter += 1;
  const attributes = [];

  if (financiador) {
    attributes.push({
      uuid: `financiador-attr-${visitCounter}`,
      value: financiador,
      attributeType: { uuid: financiadorAttributeTypeUuid },
    });
  }
  if (status) {
    attributes.push({
      uuid: `status-attr-${visitCounter}`,
      value: status,
      attributeType: { uuid: statusAttributeTypeUuid },
    });
  }

  return {
    uuid: `visit-${visitCounter}`,
    startDatetime,
    location: { display: 'Admisión' },
    patient: {
      uuid: `patient-${visitCounter}`,
      display: `Paciente ${visitCounter}`,
      identifiers,
    },
    attributes,
  };
}

beforeEach(() => {
  visitCounter = 0;
  vi.clearAllMocks();
});

describe('filterPendingSisVisits', () => {
  it('includes SIS visits whose accreditation is pending, not consulted, or missing', () => {
    const pendingVisit = buildVisit({ financiador: { uuid: sisConceptUuid }, status: config.pendingStatusConceptUuid });
    const notConsultedVisit = buildVisit({
      financiador: sisConceptUuid,
      status: { uuid: config.notConsultedStatusConceptUuid },
    });
    const missingStatusVisit = buildVisit({ financiador: { uuid: legacySisGratuitoConceptUuid } });

    const result = filterPendingSisVisits([pendingVisit, notConsultedVisit, missingStatusVisit], config);

    expect(result.map((visit) => visit.visitUuid)).toEqual([
      pendingVisit.uuid,
      notConsultedVisit.uuid,
      missingStatusVisit.uuid,
    ]);
    expect(result.map((visit) => visit.accreditationStatus)).toEqual(['pending', 'notConsulted', 'missing']);
  });

  it('excludes visits with other financiadores and already verified SIS visits', () => {
    const essaludVisit = buildVisit({
      financiador: { uuid: essaludConceptUuid },
      status: config.pendingStatusConceptUuid,
    });
    const verifiedActiveVisit = buildVisit({
      financiador: { uuid: sisConceptUuid },
      status: { uuid: activeStatusConceptUuid },
    });
    const verifiedInactiveVisit = buildVisit({
      financiador: { uuid: sisConceptUuid },
      status: inactiveStatusConceptUuid,
    });
    const noFinanciadorVisit = buildVisit({ status: config.pendingStatusConceptUuid });

    const result = filterPendingSisVisits(
      [essaludVisit, verifiedActiveVisit, verifiedInactiveVisit, noFinanciadorVisit],
      config,
    );

    expect(result).toEqual([]);
  });

  it('prefers the DNI identifier and falls back to the first available identifier', () => {
    const withDni = buildVisit({
      financiador: { uuid: sisConceptUuid },
      status: config.pendingStatusConceptUuid,
      identifiers: [
        { identifier: 'HC-0001', identifierType: { uuid: 'hc-type-uuid', display: 'N° Historia Clínica' } },
        { identifier: '79000002', identifierType: { uuid: config.dniIdentifierTypeUuid, display: 'DNI' } },
      ],
    });
    const withoutDni = buildVisit({
      financiador: { uuid: sisConceptUuid },
      status: config.pendingStatusConceptUuid,
      identifiers: [
        { identifier: 'CE-123', identifierType: { uuid: 'ce-type-uuid', display: 'Carné de Extranjería' } },
      ],
    });
    const withoutIdentifiers = buildVisit({
      financiador: { uuid: sisConceptUuid },
      status: config.pendingStatusConceptUuid,
      identifiers: [],
    });

    const result = filterPendingSisVisits([withDni, withoutDni, withoutIdentifiers], config);

    expect(result.map((visit) => visit.identifier)).toEqual(['79000002', 'CE-123', '--']);
  });

  it('sorts by visit start time with the oldest (longest waiting) first', () => {
    const newest = buildVisit({
      financiador: { uuid: sisConceptUuid },
      status: config.pendingStatusConceptUuid,
      startDatetime: '2026-07-17T10:30:00.000-0500',
    });
    const oldest = buildVisit({
      financiador: { uuid: sisConceptUuid },
      status: config.pendingStatusConceptUuid,
      startDatetime: '2026-07-16T22:00:00.000-0500',
    });

    const result = filterPendingSisVisits([newest, oldest], config);

    expect(result.map((visit) => visit.visitUuid)).toEqual([oldest.uuid, newest.uuid]);
  });
});

describe('usePendingSisAccreditations', () => {
  it('queries active visits with the attributes needed for the SIS filter', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [buildVisit({ financiador: { uuid: sisConceptUuid }, status: config.pendingStatusConceptUuid })],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => usePendingSisAccreditations(config));

    await waitFor(() => expect(result.current.pendingVisits).toHaveLength(1));

    const requestUrl = String(mockOpenmrsFetch.mock.calls[0]?.[0]);
    expect(requestUrl).toContain('/visit?includeInactive=false');
    expect(requestUrl).toContain('attributes:(uuid,value,attributeType:(uuid))');
    expect(result.current.pendingVisits[0]?.accreditationStatus).toBe('pending');
  });

  it('does not fetch when the viewer is not allowed to see the worklist', () => {
    renderHook(() => usePendingSisAccreditations(config, false));

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
