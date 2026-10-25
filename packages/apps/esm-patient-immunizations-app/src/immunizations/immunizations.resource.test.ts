import { openmrsFetch } from '@openmrs/esm-framework';
import type { FHIRImmunizationResource } from '../types/fhir-immunization-domain';
import { savePatientImmunization, savePatientImmunizationViaAmpathForm } from './immunizations.resource';

const vaccine = 'f9840000-0000-4000-8000-000000000984';
const administrationDate = 'f1410000-0000-4000-8000-000000001410';
const status = 'af2ec074-87e5-4651-8e7f-5578bd111cf9';
const reason = '9dab3f0d-b9da-45c3-beea-5ec3182e53be';
const lot = 'f1420000-0000-4000-8000-000000001420';
const managed = [vaccine, administrationDate, status, reason, lot];
const payload = {
  patient: 'synthetic-patient',
  encounterType: 'vaccination-encounter-type',
  obs: [
    { concept: vaccine, value: 'synthetic-product' },
    { concept: status, value: 'not-done' },
    { concept: reason, value: 'Diferida por evaluación clínica' },
  ],
};

describe('native REST immunization observation updates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reuses Obs UUIDs, voids removed values and preserves unrelated observations in one update', async () => {
    vi.mocked(openmrsFetch)
      .mockResolvedValueOnce({
        data: {
          uuid: 'existing-encounter',
          patient: { uuid: 'synthetic-patient' },
          obs: [
            { uuid: 'existing-product', concept: { uuid: vaccine } },
            { uuid: 'existing-date', concept: { uuid: administrationDate } },
            { uuid: 'existing-status', concept: { uuid: status } },
            { uuid: 'existing-lot', concept: { uuid: lot } },
            { uuid: 'unrelated-obs', concept: { uuid: 'another-concept' } },
          ],
        },
      } as never)
      .mockResolvedValueOnce({ data: { uuid: 'existing-encounter' } } as never);
    await savePatientImmunizationViaAmpathForm(
      {
        ...payload,
        form: 'different-form',
        visit: 'different-visit',
        location: 'different-location',
        encounterDatetime: '2026-05-28T15:00:00Z',
        encounterProviders: [{ provider: 'different-provider', encounterRole: 'different-role' }],
      },
      'existing-encounter',
      new AbortController(),
      managed,
    );
    expect(openmrsFetch).toHaveBeenCalledTimes(2);
    const update = vi.mocked(openmrsFetch).mock.calls[1][1];
    expect(update).toMatchObject({
      method: 'POST',
      body: {
        obs: [
          { uuid: 'existing-product', concept: vaccine, value: 'synthetic-product' },
          { uuid: 'existing-date', voided: true, voidReason: 'Updated immunization record' },
          { uuid: 'existing-status', concept: status, value: 'not-done' },
          { uuid: 'existing-lot', voided: true, voidReason: 'Updated immunization record' },
          { uuid: 'unrelated-obs' },
          { concept: reason, value: 'Diferida por evaluación clínica' },
        ],
      },
    });
    expect(update.body).not.toHaveProperty('encounterDatetime');
    expect(update.body).not.toHaveProperty('form');
    expect(update.body).not.toHaveProperty('encounterProviders');
    expect(Object.keys(update.body)).toEqual(['obs']);
  });

  it('does not write when an encounter has ambiguous active values for the same concept', async () => {
    vi.mocked(openmrsFetch).mockResolvedValueOnce({
      data: {
        uuid: 'existing-encounter',
        patient: { uuid: 'synthetic-patient' },
        obs: [
          { uuid: 'duplicate-a', concept: { uuid: vaccine } },
          { uuid: 'duplicate-b', concept: { uuid: vaccine } },
        ],
      },
    } as never);
    await expect(
      savePatientImmunizationViaAmpathForm(payload, 'existing-encounter', new AbortController(), managed),
    ).rejects.toThrow('ambiguous observations');
    expect(openmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('does not write when a fresh read fails or returns another encounter', async () => {
    vi.mocked(openmrsFetch).mockRejectedValueOnce(new Error('read failed'));
    await expect(
      savePatientImmunizationViaAmpathForm(payload, 'existing-encounter', new AbortController(), managed),
    ).rejects.toThrow();
    expect(openmrsFetch).toHaveBeenCalledTimes(1);
    vi.mocked(openmrsFetch).mockResolvedValueOnce({ data: { uuid: 'different-encounter', obs: [] } } as never);
    await expect(
      savePatientImmunizationViaAmpathForm(payload, 'existing-encounter', new AbortController(), managed),
    ).rejects.toThrow();
    expect(openmrsFetch).toHaveBeenCalledTimes(2);
  });

  it.each(['another-patient', undefined])(
    'does not write without a verified matching patient (%s)',
    async (patientUuid) => {
      vi.mocked(openmrsFetch).mockResolvedValueOnce({
        data: {
          uuid: 'existing-encounter',
          patient: { uuid: patientUuid },
          obs: [],
        },
      } as never);
      await expect(
        savePatientImmunizationViaAmpathForm(payload, 'existing-encounter', new AbortController(), managed),
      ).rejects.toThrow('could not be verified');
      expect(openmrsFetch).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves the explicit creation context when creating a new encounter', async () => {
    const creation = {
      ...payload,
      form: 'verified-form',
      encounterDatetime: '2026-05-28T15:00:00Z',
      visit: 'synthetic-visit',
      location: 'synthetic-location',
      encounterProviders: [{ provider: 'synthetic-provider', encounterRole: 'recording-role' }],
    };
    vi.mocked(openmrsFetch).mockResolvedValueOnce({ data: { uuid: 'new-encounter' } } as never);
    await savePatientImmunizationViaAmpathForm(creation, undefined, new AbortController(), managed);
    expect(openmrsFetch).toHaveBeenCalledTimes(1);
    expect(openmrsFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'POST', body: creation }),
    );
  });
});

describe('legacy FHIR immunization updates', () => {
  const edit: FHIRImmunizationResource = {
    resourceType: 'Immunization',
    id: 'legacy-dose',
    status: 'completed',
    vaccineCode: { coding: [{ code: 'synthetic-vaccine', display: 'Synthetic vaccine' }] },
    patient: { type: 'Patient', reference: 'Patient/synthetic-patient' },
    encounter: { type: 'Encounter', reference: 'Encounter/current-visit' },
    location: { type: 'Location', reference: 'Location/current-location' },
    performer: [{ actor: { type: 'Practitioner', reference: 'Practitioner/current-editor' } }],
    occurrenceDateTime: '2020-05-28T00:00:00Z',
    recorded: '2026-10-19T16:30:00Z',
    lotNumber: 'corrected-lot',
  };

  beforeEach(() => {
    vi.mocked(openmrsFetch).mockReset();
  });

  it('freshly reads the same resource and preserves its historical actor and context', async () => {
    const original = {
      ...edit,
      encounter: { type: 'Encounter', reference: 'Encounter/historical-visit' },
      location: { type: 'Location', reference: 'Location/historical-location' },
      performer: [{ actor: { type: 'Practitioner', reference: 'Practitioner/original-administrator' } }],
      recorded: '2020-05-28T15:00:00Z',
      lotNumber: 'original-lot',
    };
    vi.mocked(openmrsFetch)
      .mockResolvedValueOnce({ data: original } as never)
      .mockResolvedValueOnce({ data: { id: edit.id } } as never);

    await savePatientImmunization(edit, edit.id, new AbortController());

    expect(openmrsFetch).toHaveBeenCalledTimes(2);
    expect(openmrsFetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/Immunization/legacy-dose'),
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(openmrsFetch).toHaveBeenLastCalledWith(
      expect.stringContaining('/Immunization/legacy-dose'),
      expect.objectContaining({ method: 'PUT', body: { ...original, lotNumber: 'corrected-lot' } }),
    );
    expect(original.lotNumber).toBe('original-lot');
  });

  it('does not invent a performer, location or record timestamp when history omits them', async () => {
    const { performer: _performer, location: _location, recorded: _recorded, ...original } = edit;
    vi.mocked(openmrsFetch)
      .mockResolvedValueOnce({ data: original } as never)
      .mockResolvedValueOnce({ data: { id: edit.id } } as never);

    await savePatientImmunization(edit, edit.id, new AbortController());

    const body = vi.mocked(openmrsFetch).mock.calls[1][1].body;
    expect(body).not.toHaveProperty('performer');
    expect(body).not.toHaveProperty('location');
    expect(body).not.toHaveProperty('recorded');
  });

  it.each([
    'identity',
    'missing-identity',
    'edit-identity',
    'patient',
    'missing-patient',
    'edit-patient',
    'resourceType',
  ])('does not PUT or create a resource when its fresh %s cannot be verified', async (field) => {
    const original = { ...edit };
    const changedEdit = { ...edit };
    if (field === 'missing-identity') delete original.id;
    if (field === 'edit-identity') changedEdit.id = 'another-dose';
    if (field === 'missing-patient') original.patient = null;
    if (field === 'edit-patient') changedEdit.patient = null;
    if (field === 'identity') original.id = 'another-dose';
    if (field === 'patient') original.patient = { type: 'Patient', reference: 'Patient/another-patient' };
    if (field === 'resourceType') Reflect.set(original, 'resourceType', 'Observation');
    vi.mocked(openmrsFetch).mockResolvedValueOnce({ data: original } as never);

    await expect(savePatientImmunization(changedEdit, edit.id, new AbortController())).rejects.toThrow(
      'could not be verified',
    );

    expect(openmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('stops after a 422 read failure without a PUT, POST or role repair', async () => {
    const error = { status: 422, message: 'Synthetic unreadable historical resource' };
    vi.mocked(openmrsFetch).mockRejectedValueOnce(error);

    await expect(savePatientImmunization(edit, edit.id, new AbortController())).rejects.toEqual(error);

    expect(openmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('keeps clearing optional clinical values while preserving the recorded context', async () => {
    const original = {
      ...edit,
      statusReason: { text: 'Historical reason' },
      manufacturer: { display: 'Historical manufacturer' },
      protocolApplied: [{ doseNumberPositiveInt: 2 }],
    };
    const { lotNumber: _lotNumber, ...clearedEdit } = edit;
    vi.mocked(openmrsFetch)
      .mockResolvedValueOnce({ data: original } as never)
      .mockResolvedValueOnce({ data: { id: edit.id } } as never);

    await savePatientImmunization(clearedEdit, edit.id, new AbortController());

    const body = JSON.parse(JSON.stringify(vi.mocked(openmrsFetch).mock.calls[1][1].body));
    expect(body).not.toHaveProperty('lotNumber');
    expect(body).not.toHaveProperty('manufacturer');
    expect(body).not.toHaveProperty('protocolApplied');
    expect(body).not.toHaveProperty('statusReason');
    expect(body.performer).toEqual(original.performer);
  });

  it('creates a new immunization with its supplied context without a historical read', async () => {
    const { id: _id, ...creation } = edit;
    vi.mocked(openmrsFetch).mockResolvedValueOnce({ data: { id: 'new-dose' } } as never);

    await savePatientImmunization(creation, undefined, new AbortController());

    expect(openmrsFetch).toHaveBeenCalledTimes(1);
    expect(openmrsFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/Immunization$/),
      expect.objectContaining({ method: 'POST', body: creation }),
    );
  });
});
