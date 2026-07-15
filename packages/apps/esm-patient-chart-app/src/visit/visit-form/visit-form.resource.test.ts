import { type FetchResponse, openmrsFetch, type Visit } from '@openmrs/esm-framework';

import {
  getDefaultVisitAttributesFromPatientAddress,
  normalizeVisitTimeFormatInput,
  normalizeVisitTimeInput,
  reconcileVisitCreation,
  sanitizeVisitTimeInput,
  VISIT_PERSISTENCE_CORRELATION_CONFLICT,
} from './visit-form.resource';

const provenanceVisitAttributeTypeUuid = '9b640334-69e7-49a8-bc8d-1a379742f2f1';
const addressExtensionUrl = 'http://openmrs.org/fhir/StructureDefinition/address';
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('reconcileVisitCreation', () => {
  const patientUuid = 'patient-uuid';
  const correlation = { attributeType: 'appointment-link-type', value: 'appointment-uuid' };
  const payload = {
    patient: patientUuid,
    location: 'location-uuid',
    visitType: 'visit-type-uuid',
    startDatetime: new Date('2026-07-14T14:00:00.000Z'),
    attributes: [correlation],
  };
  const correlatedVisit = {
    uuid: 'visit-uuid',
    patient: { uuid: patientUuid },
    location: { uuid: payload.location },
    visitType: { uuid: payload.visitType, display: 'Consulta externa' },
    startDatetime: '2026-07-14T14:00:02.000Z',
    stopDatetime: null,
    attributes: [
      {
        uuid: 'link-attribute-uuid',
        attributeType: { uuid: correlation.attributeType },
        value: correlation.value,
      },
    ],
  } as unknown as Visit;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockVisitSearch = (results: Array<Visit>) =>
    mockOpenmrsFetch.mockResolvedValue({ data: { results } } as unknown as FetchResponse<unknown>);

  it('returns the unique active visit with the exact appointment correlation and context', async () => {
    mockVisitSearch([correlatedVisit]);

    await expect(reconcileVisitCreation(patientUuid, payload, correlation)).resolves.toEqual(correlatedVisit);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/visit?patient=${patientUuid}&includeInactive=true`),
    );
  });

  it('returns null when no active visit has the correlation', async () => {
    mockVisitSearch([]);

    await expect(reconcileVisitCreation(patientUuid, payload, correlation)).resolves.toBeNull();
  });

  it('searches every visit page and deduplicates visits before correlating', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      ...correlatedVisit,
      uuid: `uncorrelated-visit-${index}`,
      attributes: [],
    })) as Array<Visit>;
    mockOpenmrsFetch
      .mockResolvedValueOnce({ data: { results: firstPage } } as unknown as FetchResponse<unknown>)
      .mockResolvedValueOnce({
        data: { results: [firstPage[99], correlatedVisit] },
      } as unknown as FetchResponse<unknown>);

    await expect(reconcileVisitCreation(patientUuid, payload, correlation)).resolves.toEqual(correlatedVisit);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
    expect(mockOpenmrsFetch).toHaveBeenLastCalledWith(expect.stringContaining('startIndex=100'));
  });

  it('accepts a stopped correlated visit when the creation payload is stopped', async () => {
    const stoppedPayload = {
      ...payload,
      stopDatetime: new Date('2026-07-14T15:00:00.000Z'),
    };
    const stoppedVisit = {
      ...correlatedVisit,
      stopDatetime: '2026-07-14T15:00:00.000Z',
    } as Visit;
    mockVisitSearch([stoppedVisit]);

    await expect(reconcileVisitCreation(patientUuid, stoppedPayload, correlation)).resolves.toEqual(stoppedVisit);
  });

  it('rejects an active correlated visit when the creation payload is stopped', async () => {
    mockVisitSearch([correlatedVisit]);

    await expect(
      reconcileVisitCreation(
        patientUuid,
        { ...payload, stopDatetime: new Date('2026-07-14T15:00:00.000Z') },
        correlation,
      ),
    ).rejects.toMatchObject({
      code: VISIT_PERSISTENCE_CORRELATION_CONFLICT,
    });
  });

  it('fails closed when more than one active visit has the same correlation', async () => {
    mockVisitSearch([correlatedVisit, { ...correlatedVisit, uuid: 'second-visit-uuid' }]);

    await expect(reconcileVisitCreation(patientUuid, payload, correlation)).rejects.toMatchObject({
      code: VISIT_PERSISTENCE_CORRELATION_CONFLICT,
    });
  });

  it.each([
    ['patient', { patient: { uuid: 'other-patient' } }],
    ['location', { location: { uuid: 'other-location' } }],
    ['visit type', { visitType: { uuid: 'other-type', display: 'Otro tipo' } }],
    ['active state', { stopDatetime: '2026-07-14T15:00:00.000Z' }],
  ])('fails closed when the correlated visit has a different %s', async (_field, override) => {
    mockVisitSearch([{ ...correlatedVisit, ...override } as Visit]);

    await expect(reconcileVisitCreation(patientUuid, payload, correlation)).rejects.toMatchObject({
      code: VISIT_PERSISTENCE_CORRELATION_CONFLICT,
    });
  });
});

describe('visit time helpers', () => {
  it('removes non-time characters from the time input', () => {
    expect(sanitizeVisitTimeInput('ww')).toBe('');
    expect(sanitizeVisitTimeInput('ww930')).toBe('9:30');
    expect(sanitizeVisitTimeInput('12:3x4')).toBe('12:34');
  });

  it('normalizes valid time input to hh:mm', () => {
    expect(normalizeVisitTimeInput('9:3')).toBe('09:03');
    expect(normalizeVisitTimeInput('930')).toBe('09:30');
    expect(normalizeVisitTimeInput('13:00')).toBe('13:00');
  });

  it('normalizes AM/PM input and rejects invalid values', () => {
    expect(normalizeVisitTimeFormatInput(' pm ')).toBe('PM');
    expect(normalizeVisitTimeFormatInput('am')).toBe('AM');
    expect(normalizeVisitTimeFormatInput('')).toBeUndefined();
    expect(normalizeVisitTimeFormatInput('xx')).toBeUndefined();
  });
});

function openmrsAddressExtension(field: string, value: string) {
  return {
    url: `${addressExtensionUrl}#${field}`,
    valueString: value,
  };
}

function openmrsAddressExtensions(...extensions: Array<ReturnType<typeof openmrsAddressExtension>>) {
  return {
    url: addressExtensionUrl,
    extension: extensions,
  };
}

describe('getDefaultVisitAttributesFromPatientAddress', () => {
  it('prefills a visit attribute from the patient residence address', () => {
    const patient = {
      address: [
        {
          use: 'home',
          city: 'San Rafael',
          district: 'Napo',
          state: 'Maynas',
          country: 'PERU',
          extension: [openmrsAddressExtensions(openmrsAddressExtension('address1', 'Loreto'))],
        },
      ],
    } as fhir.Patient;

    const defaults = getDefaultVisitAttributesFromPatientAddress(
      patient,
      [
        {
          visitAttributeTypeUuid: provenanceVisitAttributeTypeUuid,
          addressKind: 'residence',
          addressFields: ['cityVillage', 'countyDistrict', 'stateProvince', 'address1', 'country'],
          separator: ', ',
        },
      ],
      new Set([provenanceVisitAttributeTypeUuid]),
    );

    expect(defaults).toEqual({
      [provenanceVisitAttributeTypeUuid]: 'San Rafael, Napo, Maynas, Loreto, PERU',
    });
  });

  it('does not use a structured birth address as residence', () => {
    const patient = {
      address: [
        {
          use: 'home',
          city: 'Nacimiento',
          district: 'Nacimiento distrito',
          state: 'Nacimiento provincia',
          country: 'PERU',
          extension: [
            openmrsAddressExtensions(
              openmrsAddressExtension('address1', 'Nacimiento region'),
              openmrsAddressExtension('address15', 'SIHSALUS_BIRTH_ADDRESS'),
            ),
          ],
        },
        {
          use: 'home',
          city: 'Residencia',
          district: 'Residencia distrito',
          state: 'Residencia provincia',
          country: 'PERU',
          extension: [openmrsAddressExtensions(openmrsAddressExtension('address1', 'Residencia region'))],
        },
      ],
    } as fhir.Patient;

    const defaults = getDefaultVisitAttributesFromPatientAddress(
      patient,
      [
        {
          visitAttributeTypeUuid: provenanceVisitAttributeTypeUuid,
          addressKind: 'residence',
          addressFields: ['cityVillage', 'countyDistrict', 'stateProvince', 'address1', 'country'],
        },
      ],
      new Set([provenanceVisitAttributeTypeUuid]),
    );

    expect(defaults).toEqual({
      [provenanceVisitAttributeTypeUuid]:
        'Residencia, Residencia distrito, Residencia provincia, Residencia region, PERU',
    });
  });

  it('can explicitly prefill from the structured birth address', () => {
    const patient = {
      address: [
        {
          use: 'home',
          city: 'Residencia',
          district: 'Residencia distrito',
          state: 'Residencia provincia',
          country: 'PERU',
        },
        {
          city: 'Nacimiento',
          district: 'Nacimiento distrito',
          state: 'Nacimiento provincia',
          country: 'PERU',
          extension: [
            openmrsAddressExtensions(
              openmrsAddressExtension('address1', 'Nacimiento region'),
              openmrsAddressExtension('address15', 'SIHSALUS_BIRTH_ADDRESS'),
            ),
          ],
        },
      ],
    } as fhir.Patient;

    const defaults = getDefaultVisitAttributesFromPatientAddress(
      patient,
      [
        {
          visitAttributeTypeUuid: provenanceVisitAttributeTypeUuid,
          addressKind: 'birth',
          addressFields: ['cityVillage', 'countyDistrict', 'stateProvince', 'address1', 'country'],
        },
      ],
      new Set([provenanceVisitAttributeTypeUuid]),
    );

    expect(defaults).toEqual({
      [provenanceVisitAttributeTypeUuid]:
        'Nacimiento, Nacimiento distrito, Nacimiento provincia, Nacimiento region, PERU',
    });
  });

  it('skips defaults for visit attribute types that are not configured in the form', () => {
    const patient = {
      address: [
        {
          use: 'home',
          city: 'San Rafael',
        },
      ],
    } as fhir.Patient;

    const defaults = getDefaultVisitAttributesFromPatientAddress(
      patient,
      [
        {
          visitAttributeTypeUuid: provenanceVisitAttributeTypeUuid,
          addressKind: 'residence',
          addressFields: ['cityVillage'],
        },
      ],
      new Set(),
    );

    expect(defaults).toEqual({});
  });

  it('trims empty values and removes duplicate address segments', () => {
    const patient = {
      address: [
        {
          use: 'home',
          city: 'Napo ',
          district: 'Napo',
          state: '',
          country: 'PERU',
          extension: [openmrsAddressExtensions(openmrsAddressExtension('address1', 'Loreto'))],
        },
      ],
    } as fhir.Patient;

    const defaults = getDefaultVisitAttributesFromPatientAddress(
      patient,
      [
        {
          visitAttributeTypeUuid: provenanceVisitAttributeTypeUuid,
          addressKind: 'residence',
          addressFields: ['cityVillage', 'countyDistrict', 'stateProvince', 'address1', 'country'],
        },
      ],
      new Set([provenanceVisitAttributeTypeUuid]),
    );

    expect(defaults).toEqual({
      [provenanceVisitAttributeTypeUuid]: 'Napo, Loreto, PERU',
    });
  });
});
