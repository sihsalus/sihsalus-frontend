import type { PatientProgram } from '../types';
import { evaluateShowWhenExpression } from './evaluate-show-when-expression';

const enrollment = (programUuid: string, programName: string) =>
  ({ program: { uuid: programUuid, name: programName } }) as PatientProgram;

describe('evaluateShowWhenExpression', () => {
  it.each([undefined, null, '', '   '])('shows the group when the expression is absent (%s)', (expression) => {
    expect(evaluateShowWhenExpression(expression, null, null)).toBe(true);
  });

  it('evaluates patient fields', () => {
    const patient = { id: 'patient-uuid', gender: 'female' } as fhir.Patient;

    expect(evaluateShowWhenExpression('patient.gender === "female"', patient, [])).toBe(true);
    expect(evaluateShowWhenExpression('patient.gender === "male"', patient, [])).toBe(false);
  });

  it('handles a missing patient according to the expression instead of matching text inside string literals', () => {
    const enrollments = [enrollment('program-uuid', 'patient support')];

    expect(evaluateShowWhenExpression('patient && patient.gender === "female"', null, enrollments)).toBe(false);
    expect(evaluateShowWhenExpression('enrollment.includes("patient support")', null, enrollments)).toBe(true);
  });

  it('provides program names and UUIDs from every valid enrollment', () => {
    const enrollments = [enrollment('maternal-program-uuid', 'Madre Gestante'), enrollment('cred-uuid', 'CRED')];

    expect(evaluateShowWhenExpression('enrollment.includes("Madre Gestante")', null, enrollments)).toBe(true);
    expect(evaluateShowWhenExpression('programUuids.includes("cred-uuid")', null, enrollments)).toBe(true);
    expect(evaluateShowWhenExpression('programUuids.includes("unknown")', null, enrollments)).toBe(false);
  });

  it('handles absent enrollment data safely', () => {
    expect(evaluateShowWhenExpression('enrollment.includes("CRED")', undefined, undefined)).toBe(false);
    expect(evaluateShowWhenExpression('programUuids.includes("cred-uuid")', undefined, null)).toBe(false);
  });

  it('returns false rather than throwing for an invalid expression', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => evaluateShowWhenExpression('patient..gender', { id: 'patient-uuid' }, [])).not.toThrow();
    expect(evaluateShowWhenExpression('patient..gender', { id: 'patient-uuid' }, [])).toBe(false);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
