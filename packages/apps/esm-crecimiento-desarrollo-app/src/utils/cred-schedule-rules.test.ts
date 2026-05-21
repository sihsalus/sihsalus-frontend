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
        targetDate: new Date('2024-01-31T00:00:00.000Z'),
      }),
    );
    expect(schedule.at(-1)).toEqual(
      expect.objectContaining({
        controlNumber: 27,
        targetDate: new Date('2035-01-01T00:00:00.000Z'),
      }),
    );
  });
});
