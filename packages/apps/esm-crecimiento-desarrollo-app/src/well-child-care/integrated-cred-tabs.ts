import { Calendar, ChartLineData, Eyedropper, Growth, Stethoscope, UserFollow } from '@carbon/react/icons';
import { type Session, userHasAccess } from '@openmrs/esm-framework';
import { growthDevelopmentPrivilege, immunizationPrivilege } from '../constants';

export const integratedCredSections = [
  {
    id: 'antecedents',
    labelKey: 'credAntecedentsTab',
    descriptionKey: 'credAntecedentsDescription',
    icon: UserFollow,
    readPrivileges: [growthDevelopmentPrivilege],
  },
  {
    id: 'control',
    labelKey: 'credControlTab',
    descriptionKey: 'credControlDescription',
    icon: Stethoscope,
    readPrivileges: [growthDevelopmentPrivilege],
  },
  {
    id: 'growth',
    labelKey: 'credGrowthTab',
    descriptionKey: 'credGrowthDescription',
    icon: ChartLineData,
    readPrivileges: [growthDevelopmentPrivilege],
  },
  {
    id: 'development',
    labelKey: 'credDevelopmentTab',
    descriptionKey: 'credDevelopmentDescription',
    icon: Growth,
    readPrivileges: [growthDevelopmentPrivilege],
  },
  {
    id: 'immunization',
    labelKey: 'credImmunizationTab',
    descriptionKey: 'credImmunizationDescription',
    icon: Eyedropper,
    readPrivileges: [immunizationPrivilege],
  },
  {
    id: 'followup',
    labelKey: 'credFollowupTab',
    descriptionKey: 'credFollowupDescription',
    icon: Calendar,
    readPrivileges: [growthDevelopmentPrivilege],
  },
] as const;

export type IntegratedCredSectionId = (typeof integratedCredSections)[number]['id'];

export function canReadIntegratedCred(session: Session | null | undefined): boolean {
  const user = session?.user;
  return Boolean(
    session?.authenticated &&
      user?.uuid &&
      userHasAccess(growthDevelopmentPrivilege, user),
  );
}
