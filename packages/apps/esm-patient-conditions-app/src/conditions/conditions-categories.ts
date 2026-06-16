import type { AntecedentTypeCode } from '@openmrs/esm-patient-common-lib';
import type { Condition } from './conditions.resource';

export type ConditionSection = 'antecedents' | 'other-antecedents' | 'active-problems' | 'past-diagnoses';

export const workspaceNamesBySection: Record<ConditionSection, string> = {
  antecedents: 'conditions-form-workspace',
  'other-antecedents': 'conditions-form-workspace',
  'active-problems': 'active-problem-form-workspace',
  'past-diagnoses': 'past-diagnosis-form-workspace',
};

export const defaultAntecedentTypeBySection: Partial<Record<ConditionSection, AntecedentTypeCode>> = {
  'active-problems': 'pathological',
  'past-diagnoses': 'definitive-diagnosis',
};

export const defaultClinicalStatusBySection: Partial<Record<ConditionSection, 'active' | 'inactive'>> = {
  'active-problems': 'active',
  'past-diagnoses': 'inactive',
};

export function isProcedureOrSurgery(condition: Condition) {
  return condition.antecedentType === 'surgical';
}

export function isPastDiagnosis(condition: Condition) {
  return condition.antecedentType === 'definitive-diagnosis';
}

export function isActiveProblem(condition: Condition) {
  return condition.clinicalStatus === 'Active' && !isPastDiagnosis(condition) && !isProcedureOrSurgery(condition);
}

export function isGeneralAntecedent(condition: Condition) {
  return !isActiveProblem(condition) && !isPastDiagnosis(condition) && !isProcedureOrSurgery(condition);
}

export function filterConditionsBySection(conditions: Array<Condition>, section: ConditionSection) {
  switch (section) {
    case 'active-problems':
      return conditions.filter(isActiveProblem);
    case 'past-diagnoses':
      return conditions.filter(isPastDiagnosis);
    case 'other-antecedents':
      return conditions.filter(isGeneralAntecedent);
    case 'antecedents':
    default:
      return conditions.filter((condition) => !isPastDiagnosis(condition) && !isProcedureOrSurgery(condition));
  }
}
