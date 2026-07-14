import {
  createCREDControlsSchema,
  getConsultationDatetime,
  getCREDConsultationChronologyError,
  getCREDMinimumConsultationDate,
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

  it('rejects a consultation on or after the twelfth birthday', () => {
    const birthDate = new Date(2026, 6, 14);

    expect(getCREDConsultationChronologyError(new Date(2038, 6, 14, 9), birthDate, new Date(2038, 6, 14, 10))).toBe(
      'afterCredAgeLimit',
    );
    expect(
      getCREDConsultationChronologyError(new Date(2038, 6, 13, 9), birthDate, new Date(2038, 6, 14, 10)),
    ).toBeNull();
  });

  it('rejects a consultation time in the future', () => {
    const error = getCREDConsultationChronologyError(
      new Date(2026, 6, 14, 16),
      new Date(2026, 4, 10),
      new Date(2026, 6, 14, 15),
    );

    expect(error).toBe('future');
  });

  it('rejects a consultation before the visit start datetime', () => {
    const error = getCREDConsultationChronologyError(
      new Date(2026, 6, 14, 9),
      new Date(2026, 4, 10),
      new Date(2026, 6, 14, 15),
      new Date(2026, 6, 14, 10),
    );

    expect(error).toBe('beforeVisit');
  });

  it('rejects a consultation after a closed visit', () => {
    const error = getCREDConsultationChronologyError(
      new Date(2026, 6, 14, 13),
      new Date(2026, 4, 10),
      new Date(2026, 6, 14, 15),
      new Date(2026, 6, 14, 10),
      new Date(2026, 6, 14, 12),
    );

    expect(error).toBe('afterVisit');
  });

  it('allows a consultation at the exact visit start datetime', () => {
    const visitStart = new Date(2026, 6, 14, 10);
    const error = getCREDConsultationChronologyError(
      visitStart,
      new Date(2026, 4, 10),
      new Date(2026, 6, 14, 15),
      visitStart,
    );

    expect(error).toBeNull();
  });

  it('uses the later of birth date and visit start as the calendar minimum without shifting date-only values', () => {
    expect(getCREDMinimumConsultationDate('2026-07-10', '2026-07-14T10:00:00-05:00')).toBe('2026-07-14T10:00:00-05:00');
    expect(getCREDMinimumConsultationDate('2026-07-10')).toBe('2026-07-10');
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

  it('exposes a same-day visit-range validation on the time field', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 6, 14, 15));
    const schema = createCREDControlsSchema(
      t,
      new Date(2026, 4, 10),
      new Date(2026, 6, 14, 10),
      new Date(2026, 6, 14, 14),
    );

    const result = schema.safeParse({
      visitStartDate: new Date(2026, 6, 14),
      visitStartTime: '09:00',
      visitStartTimeFormat: 'AM',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['visitStartTime'],
            message: 'La fecha y hora de atención no puede ser anterior al inicio de la visita.',
          }),
        ]),
      );
    }
  });

  it('rejects a new control before the minimum interval date', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 7, 20, 15));
    const schema = createCREDControlsSchema(
      t,
      new Date(2026, 0, 1),
      new Date(2026, 6, 1),
      undefined,
      () => new Date(2026, 7, 14),
    );

    const result = schema.safeParse({
      visitStartDate: new Date(2026, 7, 13),
      visitStartTime: '09:00',
      visitStartTimeFormat: 'AM',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['visitStartDate'],
            message: 'La fecha de atención no puede ser anterior al intervalo mínimo del siguiente control CRED.',
          }),
        ]),
      );
    }
  });

  it('allows a new control on the exact minimum interval date', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 7, 20, 15));
    const schema = createCREDControlsSchema(
      t,
      new Date(2026, 0, 1),
      new Date(2026, 6, 1),
      undefined,
      () => new Date(2026, 7, 14),
    );

    expect(
      schema.safeParse({
        visitStartDate: new Date(2026, 7, 14),
        visitStartTime: '09:00',
        visitStartTimeFormat: 'AM',
      }).success,
    ).toBe(true);
  });

  it('allows reopening an existing control before the next control minimum', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 7, 20, 15));
    const existingControlDate = new Date(2026, 6, 15);
    const schema = createCREDControlsSchema(
      t,
      new Date(2026, 0, 1),
      new Date(2026, 6, 1),
      undefined,
      (consultationDate) =>
        consultationDate.toDateString() === existingControlDate.toDateString() ? undefined : new Date(2026, 7, 14),
    );

    expect(
      schema.safeParse({
        visitStartDate: existingControlDate,
        visitStartTime: '09:00',
        visitStartTimeFormat: 'AM',
      }).success,
    ).toBe(true);
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

  it('does not reuse control 27 for a new visit after reaching the normative maximum', () => {
    const completedControls = Array.from({ length: 27 }, (_, index) => ({
      uuid: `control-${index + 1}`,
      encounterDatetime: `2026-07-${String(index + 1).padStart(2, '0')}T09:00:00-05:00`,
      visit: { uuid: `visit-${index + 1}` },
      controlNumber: index + 1,
    }));

    expect(resolveCREDControlNumber(completedControls, new Date('2026-08-01T09:00:00-05:00'), 'new-visit')).toBeNull();
  });

  it('allows reopening control 27 in the same visit and day', () => {
    const completedControls = Array.from({ length: 27 }, (_, index) => ({
      uuid: `control-${index + 1}`,
      encounterDatetime: `2026-07-${String(index + 1).padStart(2, '0')}T09:00:00-05:00`,
      visit: { uuid: `visit-${index + 1}` },
      controlNumber: index + 1,
    }));

    expect(resolveCREDControlNumber(completedControls, new Date('2026-07-27T15:00:00-05:00'), 'visit-27')).toBe(27);
  });
});
