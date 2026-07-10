import { generateCREDSchedule, getCREDControlDefinitions } from './cred-schedule-rules';

describe('cred-schedule-rules', () => {
  it('exposes the NTS 238 expected static control definitions', () => {
    const definitions = getCREDControlDefinitions();

    expect(definitions).toHaveLength(27);
    expect(definitions[0]).toEqual(
      expect.objectContaining({
        controlNumber: 1,
        label: 'RN - 3 a 6 días',
        phase: 'neonatal',
      }),
    );
    expect(definitions.at(-1)).toEqual(
      expect.objectContaining({
        controlNumber: 27,
        label: '11 años',
        phase: 'school',
      }),
    );
  });

  it('builds a concrete schedule from the provided birth date', () => {
    const schedule = generateCREDSchedule('2024-01-01T00:00:00.000Z');

    expect(schedule).toHaveLength(27);
    expect(schedule[0]).toEqual(
      expect.objectContaining({
        controlNumber: 1,
        targetDate: new Date('2024-01-04T00:00:00.000Z'),
      }),
    );
    expect(schedule[3]).toEqual(
      expect.objectContaining({
        controlNumber: 4,
        label: '1 mes',
        targetDate: new Date('2024-02-01T00:00:00.000Z'),
      }),
    );
    expect(schedule.at(-1)).toEqual(
      expect.objectContaining({
        controlNumber: 27,
        targetDate: new Date('2035-01-01T00:00:00.000Z'),
      }),
    );
  });

  it('uses normative windows before marking an ideal control as missed', () => {
    const schedule = generateCREDSchedule('2024-01-01T00:00:00.000Z');

    expect(schedule[0].dueEndDate).toEqual(new Date('2024-01-07T00:00:00.000Z'));
    expect(schedule[1].dueEndDate).toEqual(new Date('2024-01-14T00:00:00.000Z'));
    expect(schedule[2].dueEndDate).toEqual(new Date('2024-01-22T00:00:00.000Z'));
    expect(schedule[3].dueEndDate).toEqual(new Date('2024-02-29T00:00:00.000Z'));
  });

  it('keeps control numbers and target dates increasing through each phase', () => {
    const schedule = generateCREDSchedule('2024-01-01T00:00:00.000Z');

    expect(schedule.map((control) => control.controlNumber)).toEqual(
      Array.from({ length: 27 }, (_, index) => index + 1),
    );
    expect(schedule.every((control, index) => index === 0 || control.targetDate > schedule[index - 1].targetDate)).toBe(
      true,
    );
    expect(
      schedule.reduce(
        (counts, control) => {
          counts[control.phase] = (counts[control.phase] ?? 0) + 1;
          return counts;
        },
        {} as Record<string, number>,
      ),
    ).toEqual({
      neonatal: 3,
      infant: 7,
      toddler: 5,
      preschool: 5,
      school: 7,
    });
  });
});
