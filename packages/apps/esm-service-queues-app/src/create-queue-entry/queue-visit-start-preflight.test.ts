import { getQueueVisitStartPreflightState } from './queue-visit-start-preflight';

const referenceDate = '2026-08-11';
const validInput = {
  birthDate: '1990-04-20',
  canStartVisit: true,
  hasCompanionCapability: false,
  needsNewVisit: true,
  patientError: null,
  patientIsLoading: false,
  referenceDate,
};

describe('queue visit start preflight', () => {
  it('does not apply visit creation checks to an active visit or an administrative queue', () => {
    expect(
      getQueueVisitStartPreflightState({
        ...validInput,
        birthDate: undefined,
        canStartVisit: false,
        needsNewVisit: false,
        patientError: new Error('Patient unavailable'),
      }),
    ).toBe('not-required');
  });

  it('blocks the new-visit branch before patient validation when visit creation access is missing', () => {
    expect(getQueueVisitStartPreflightState({ ...validInput, canStartVisit: false })).toBe('visit-capability-missing');
  });

  it('fails closed while patient age is loading or the patient request failed', () => {
    expect(getQueueVisitStartPreflightState({ ...validInput, patientIsLoading: true })).toBe('patient-loading');
    expect(getQueueVisitStartPreflightState({ ...validInput, patientError: new Error('Patient request failed') })).toBe(
      'patient-age-unavailable',
    );
  });

  it.each([
    undefined,
    '',
    'not-a-date',
    '2010-02-30',
    '2027-01-01',
  ])('fails closed for unavailable or invalid birth date %s', (birthDate) => {
    expect(getQueueVisitStartPreflightState({ ...validInput, birthDate })).toBe('patient-age-unavailable');
  });

  it('requires a companion capability for a minor', () => {
    expect(getQueueVisitStartPreflightState({ ...validInput, birthDate: '2016-08-11' })).toBe(
      'companion-capability-missing',
    );
    expect(
      getQueueVisitStartPreflightState({
        ...validInput,
        birthDate: '2016-08-11',
        hasCompanionCapability: true,
      }),
    ).toBe('ready');
  });

  it('allows an adult, including the exact eighteenth birthday, without companion access', () => {
    expect(getQueueVisitStartPreflightState(validInput)).toBe('ready');
    expect(getQueueVisitStartPreflightState({ ...validInput, birthDate: '2008-08-11' })).toBe('ready');
  });
});
