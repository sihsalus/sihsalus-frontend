import { Calendar, ChartLineData, Eyedropper, Growth, Stethoscope, UserFollow } from '@carbon/react/icons';
import { type Session, userHasAccess } from '@openmrs/esm-framework';
import {
  credAntecedentsPrivilege,
  credCourseLifePrivilege,
  credEarlyStimulationPrivilege,
  credImmunizationPrivilege,
  credNeonatalPrivilege,
  credNutritionPrivilege,
  credWellChildPrivilege,
} from '../constants';

export const integratedCredSections = [
  {
    id: 'antecedents',
    labelKey: 'credAntecedentsTab',
    descriptionKey: 'credAntecedentsDescription',
    icon: UserFollow,
    readPrivileges: [credAntecedentsPrivilege, credNeonatalPrivilege],
  },
  {
    id: 'control',
    labelKey: 'credControlTab',
    descriptionKey: 'credControlDescription',
    icon: Stethoscope,
    readPrivileges: [credWellChildPrivilege],
  },
  {
    id: 'growth',
    labelKey: 'credGrowthTab',
    descriptionKey: 'credGrowthDescription',
    icon: ChartLineData,
    readPrivileges: [credWellChildPrivilege, credNeonatalPrivilege, credNutritionPrivilege],
  },
  {
    id: 'development',
    labelKey: 'credDevelopmentTab',
    descriptionKey: 'credDevelopmentDescription',
    icon: Growth,
    readPrivileges: [credEarlyStimulationPrivilege],
  },
  {
    id: 'immunization',
    labelKey: 'credImmunizationTab',
    descriptionKey: 'credImmunizationDescription',
    icon: Eyedropper,
    readPrivileges: [credImmunizationPrivilege],
  },
  {
    id: 'followup',
    labelKey: 'credFollowupTab',
    descriptionKey: 'credFollowupDescription',
    icon: Calendar,
    readPrivileges: [credWellChildPrivilege, credNutritionPrivilege, credEarlyStimulationPrivilege],
  },
] as const;

export type IntegratedCredSectionId = (typeof integratedCredSections)[number]['id'];

export function canReadIntegratedCred(session: Session | null | undefined): boolean {
  const user = session?.user;
  return Boolean(
    session?.authenticated &&
      user?.uuid &&
      userHasAccess(credCourseLifePrivilege, user) &&
      integratedCredSections.some(({ readPrivileges }) =>
        readPrivileges.some((privilege) => userHasAccess(privilege, user)),
      ),
  );
}
