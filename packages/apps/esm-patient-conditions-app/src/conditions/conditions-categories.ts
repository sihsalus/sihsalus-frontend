import type { AntecedentTypeCode } from '@openmrs/esm-patient-common-lib';
import type { Condition } from './conditions.resource';

export type ConditionSection = 'antecedents' | 'other-antecedents' | 'active-problems' | 'past-diagnoses';
export type ConditionDestination = Exclude<ConditionSection, 'antecedents'> | 'procedures';
export type ConditionStatusFilter = 'All' | 'Active' | 'Inactive';

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

export const defaultStatusFilterBySection: Record<ConditionSection, ConditionStatusFilter> = {
  antecedents: 'All',
  'active-problems': 'Active',
  'other-antecedents': 'All',
  'past-diagnoses': 'All',
};

export function getConditionDestination(antecedentType?: string, clinicalStatus?: string): ConditionDestination {
  if (antecedentType === 'surgical') {
    return 'procedures';
  }

  if (antecedentType === 'definitive-diagnosis') {
    return 'past-diagnoses';
  }

  if (clinicalStatus?.toLowerCase() === 'active') {
    return 'active-problems';
  }

  return 'other-antecedents';
}

export function isProcedureOrSurgery(condition: Condition) {
  return getConditionDestination(condition.antecedentType, condition.clinicalStatus) === 'procedures';
}

export function isPastDiagnosis(condition: Condition) {
  return getConditionDestination(condition.antecedentType, condition.clinicalStatus) === 'past-diagnoses';
}

export function isActiveProblem(condition: Condition) {
  return getConditionDestination(condition.antecedentType, condition.clinicalStatus) === 'active-problems';
}

export function isGeneralAntecedent(condition: Condition) {
  return getConditionDestination(condition.antecedentType, condition.clinicalStatus) === 'other-antecedents';
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
