import { describe, expect, it } from 'vitest';
import { isPatientProgramEnrollmentCacheKey } from './program-enrollment-cache';

describe('program enrollment cache', () => {
  it('matches any program enrollment cache key for the same patient regardless of representation', () => {
    expect(
      isPatientProgramEnrollmentCacheKey(
        '/ws/rest/v1/programenrollment?patient=patient-uuid&v=custom:(uuid,display,program)',
        'patient-uuid',
      ),
    ).toBe(true);

    expect(
      isPatientProgramEnrollmentCacheKey(
        '/ws/rest/v1/programenrollment?patient=patient-uuid&v=custom:(uuid,display,program,dateEnrolled)',
        'patient-uuid',
      ),
    ).toBe(true);
  });

  it('does not match another patient or another resource', () => {
    expect(
      isPatientProgramEnrollmentCacheKey(
        '/ws/rest/v1/programenrollment?patient=another-patient&v=custom:(uuid,display,program)',
        'patient-uuid',
      ),
    ).toBe(false);
    expect(isPatientProgramEnrollmentCacheKey('/ws/rest/v1/program?v=custom:(uuid,display)', 'patient-uuid')).toBe(
      false,
    );
  });

  it('supports tuple SWR keys when the URL is one of the string entries', () => {
    expect(
      isPatientProgramEnrollmentCacheKey(
        ['program-enrollment', '/ws/rest/v1/programenrollment?patient=patient-uuid&v=custom:(uuid,display,program)'],
        'patient-uuid',
      ),
    ).toBe(true);
  });
});
