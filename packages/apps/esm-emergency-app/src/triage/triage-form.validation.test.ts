import { type ConceptReferenceRange } from '../hooks/useConceptReferenceRanges';
import {
  assessValue,
  type TriageFormData,
  triageFormSchema,
  type VitalFieldName,
  validateVitalsAgainstRanges,
  vitalSignRanges,
} from './triage-form.validation';

// ============================================================================
// SCHEMA VALIDATION
// ============================================================================

describe('triageFormSchema', () => {
  const validData = {
    priorityUuid: '9b4acfe0-735f-4701-b1c8-4fbf4a66bb7e',
  };

  it('accepts minimal valid data (only priorityUuid required)', () => {
    const result = triageFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects missing priorityUuid', () => {
    const result = triageFormSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid priorityUuid format', () => {
    const result = triageFormSchema.safeParse({ priorityUuid: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('accepts all vital signs within valid ranges', () => {
    const result = triageFormSchema.safeParse({
      ...validData,
      temperature: 36.5,
      heartRate: 80,
      respiratoryRate: 16,
      systolicBp: 120,
      diastolicBp: 80,
      oxygenSaturation: 98,
    });
    expect(result.success).toBe(true);
  });

  it('rejects temperature below minimum', () => {
    const result = triageFormSchema.safeParse({
      ...validData,
      temperature: vitalSignRanges.temperature.min - 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects temperature above maximum', () => {
    const result = triageFormSchema.safeParse({
      ...validData,
      temperature: vitalSignRanges.temperature.max + 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects oxygen saturation above 100%', () => {
    const result = triageFormSchema.safeParse({
      ...validData,
      oxygenSaturation: 101,
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid consciousness level', () => {
    const result = triageFormSchema.safeParse({
      ...validData,
      consciousnessLevel: 'alert',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid consciousness level', () => {
    const result = triageFormSchema.safeParse({
      ...validData,
      consciousnessLevel: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid weight and height', () => {
    const result = triageFormSchema.safeParse({
      ...validData,
      weight: 70,
      height: 165,
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional text fields', () => {
    const result = triageFormSchema.safeParse({
      ...validData,
      illnessDuration: '6 horas',
      onsetType: 'Súbito',
      course: 'Progresivo',
      anamnesis: 'Dolor torácico',
      clinicalExam: 'MEG, diaforético',
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// assessValue
// ============================================================================

describe('assessValue', () => {
  const range: ConceptReferenceRange = {
    lowAbsolute: 30,
    lowCritical: 34,
    lowNormal: 36.1,
    hiNormal: 37.2,
    hiCritical: 40,
    hiAbsolute: 47,
    units: '°C',
  };

  it('returns "normal" when value is within normal range', () => {
    expect(assessValue(36.5, range)).toBe('normal');
  });

  it('returns "high" when value exceeds hiNormal but below hiCritical', () => {
    expect(assessValue(38.5, range)).toBe('high');
  });

  it('returns "critically_high" when value >= hiCritical', () => {
    expect(assessValue(40, range)).toBe('critically_high');
    expect(assessValue(42, range)).toBe('critically_high');
  });

  it('returns "low" when value < lowNormal but above lowCritical', () => {
    expect(assessValue(35, range)).toBe('low');
  });

  it('returns "critically_low" when value <= lowCritical', () => {
    expect(assessValue(34, range)).toBe('critically_low');
    expect(assessValue(30, range)).toBe('critically_low');
  });

  it('returns "normal" when no range is provided', () => {
    expect(assessValue(999, undefined)).toBe('normal');
  });

  it('returns "normal" when value is undefined', () => {
    expect(assessValue(undefined, range)).toBe('normal');
  });

  it('handles range with missing fields gracefully', () => {
    const partialRange: ConceptReferenceRange = {
      lowAbsolute: null,
      lowCritical: null,
      lowNormal: null,
      hiNormal: 37.2,
      hiCritical: null,
      hiAbsolute: null,
      units: '°C',
    };
    expect(assessValue(38, partialRange)).toBe('high');
    expect(assessValue(36, partialRange)).toBe('normal');
  });
});

// ============================================================================
// validateVitalsAgainstRanges
// ============================================================================

describe('validateVitalsAgainstRanges', () => {
  const mockT = (_key: string, defaultValue: string, options?: Record<string, unknown>) => {
    let result = defaultValue;
    if (options) {
      for (const [k, v] of Object.entries(options)) {
        result = result.replace(`{{${k}}}`, String(v));
      }
    }
    return result;
  };

  const fieldToConceptUuid: Record<VitalFieldName, string> = {
    temperature: 'concept-temp',
    heartRate: 'concept-hr',
    respiratoryRate: 'concept-rr',
    systolicBp: 'concept-sbp',
    diastolicBp: 'concept-dbp',
    oxygenSaturation: 'concept-spo2',
  };

  const referenceRanges: Record<string, ConceptReferenceRange> = {
    'concept-sbp': {
      lowAbsolute: 105,
      lowCritical: null,
      lowNormal: null,
      hiNormal: null,
      hiCritical: null,
      hiAbsolute: 260,
      units: 'mmHg',
    },
  };

  it('returns no errors when all values are within range', () => {
    const data: TriageFormData = {
      systolicBp: 120,
      priorityUuid: '9b4acfe0-735f-4701-b1c8-4fbf4a66bb7e',
    };
    const errors = validateVitalsAgainstRanges(data, fieldToConceptUuid, referenceRanges, mockT);
    expect(errors).toHaveLength(0);
  });

  it('returns error when value is below lowAbsolute', () => {
    const data: TriageFormData = {
      systolicBp: 90,
      priorityUuid: '9b4acfe0-735f-4701-b1c8-4fbf4a66bb7e',
    };
    const errors = validateVitalsAgainstRanges(data, fieldToConceptUuid, referenceRanges, mockT);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('systolicBp');
    expect(errors[0].message).toContain('90');
    expect(errors[0].message).toContain('105');
  });

  it('returns error when value exceeds hiAbsolute', () => {
    const data: TriageFormData = {
      systolicBp: 270,
      priorityUuid: '9b4acfe0-735f-4701-b1c8-4fbf4a66bb7e',
    };
    const errors = validateVitalsAgainstRanges(data, fieldToConceptUuid, referenceRanges, mockT);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('systolicBp');
    expect(errors[0].message).toContain('270');
  });

  it('skips fields with no value', () => {
    const data: TriageFormData = {
      priorityUuid: '9b4acfe0-735f-4701-b1c8-4fbf4a66bb7e',
    };
    const errors = validateVitalsAgainstRanges(data, fieldToConceptUuid, referenceRanges, mockT);
    expect(errors).toHaveLength(0);
  });

  it('skips fields with no reference range', () => {
    const data: TriageFormData = {
      temperature: 36.5,
      priorityUuid: '9b4acfe0-735f-4701-b1c8-4fbf4a66bb7e',
    };
    // concept-temp has no entry in referenceRanges
    const errors = validateVitalsAgainstRanges(data, fieldToConceptUuid, referenceRanges, mockT);
    expect(errors).toHaveLength(0);
  });
});
