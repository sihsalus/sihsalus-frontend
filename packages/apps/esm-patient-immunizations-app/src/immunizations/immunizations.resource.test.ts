import { openmrsFetch } from '@openmrs/esm-framework';
import { savePatientImmunizationViaAmpathForm } from './immunizations.resource';

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
