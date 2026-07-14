import {
  createCREDControlsSchema,
  getConsultationDatetime,
  getCREDConsultationChronologyError,
  resolveCREDControlNumber,
} from './well-child-controls-form.workspace';

const t = (_key: string, fallback: string) => fallback;

describe('CRED consultation chronology', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['12:15', 'AM' as const, 0],
    ['12:15', 'PM' as const, 12],
    ['01:15', 'PM' as const, 13],
  ])('converts %s %s to the expected 24-hour value', (time, format, expectedHour) => {
    const consultationDatetime = getConsultationDatetime({
      visitStartDate: new Date(2026, 6, 14),
      visitStartTime: time,
      visitStartTimeFormat: format,
    });

    expect(consultationDatetime.getHours()).toBe(expectedHour);
    expect(consultationDatetime.getMinutes()).toBe(15);
  });

  it('rejects a consultation date before the patient birth date', () => {
    const error = getCREDConsultationChronologyError(
      new Date(2026, 4, 9, 9),
      new Date(2026, 4, 10),
      new Date(2026, 6, 14),
    );

    expect(error).toBe('beforeBirth');
  });

  it('allows a consultation on the patient birth date', () => {
    const error = getCREDConsultationChronologyError(
      new Date(2026, 4, 10, 9),
      new Date(2026, 4, 10, 18),
      new Date(2026, 6, 14),
    );

    expect(error).toBeNull();
  });

  it('rejects a consultation time in the future', () => {
    const error = getCREDConsultationChronologyError(
      new Date(2026, 6, 14, 16),
      new Date(2026, 4, 10),
      new Date(2026, 6, 14, 15),
    );

    expect(error).toBe('future');
  });

  it('exposes the birth-date validation on the date field', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 6, 14, 15));
    const schema = createCREDControlsSchema(t, new Date(2026, 4, 10));

    const result = schema.safeParse({
      visitStartDate: new Date(2026, 4, 9),
      visitStartTime: '09:00',
      visitStartTimeFormat: 'AM',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['visitStartDate'],
            message: 'La fecha de atención no puede ser anterior a la fecha de nacimiento del paciente.',
          }),
        ]),
      );
    }
  });
});

describe('resolveCREDControlNumber', () => {
  const encounters = [
    {
      uuid: 'control-1',
      encounterDatetime: '2026-06-10T09:00:00-05:00',
      visit: { uuid: 'visit-1' },
      controlNumber: 1,
    },
    {
      uuid: 'control-2',
      encounterDatetime: '2026-07-10T09:00:00-05:00',
      visit: { uuid: 'visit-2' },
      controlNumber: 2,
    },
  ];

  it('reuses the persisted number when resuming the same visit and day', () => {
    expect(resolveCREDControlNumber(encounters, new Date('2026-07-10T15:00:00-05:00'), 'visit-2')).toBe(2);
  });

  it('starts the next control for a different visit', () => {
    expect(resolveCREDControlNumber(encounters, new Date('2026-07-10T15:00:00-05:00'), 'visit-3')).toBe(3);
  });

  it('derives the sequence for a legacy control without a persisted number', () => {
    const legacyEncounters = encounters.map(({ controlNumber: _controlNumber, ...encounter }) => encounter);

    expect(resolveCREDControlNumber(legacyEncounters, new Date('2026-07-10T15:00:00-05:00'), 'visit-2')).toBe(2);
  });
});
