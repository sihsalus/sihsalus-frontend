import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib';
import type React from 'react';

import { createDashboardGroup } from './clinical-view-group/createDashboardGroup';
import { configSchema } from './config-schema';
import {
  childImmunizationScheduleDashboardMeta,
  childNutritionDashboardMeta,
  earlyStimulationDashboardMeta,
  neonatalCareDashboardMeta,
  wellChildCareNavGroup,
  wellChildControlDashboardMeta,
} from './dashboard.meta';
import ChildMedicalHistory from './ui/conditions-filter/conditions-overview.component';
// Well Child Care Components
import SlotPlaceholder from './ui/slot-placeholder/slot-placeholder.component';
import { ChildImmunizationSchedule } from './well-child-care/child-immunization.component';
import { ChildNutrition } from './well-child-care/child-nutrition.component';
import AdverseReactionsSummary from './well-child-care/components/adverse-reactions-summary/adverse-reactions-summary.component';
import AlojamientoConjunto from './well-child-care/components/alojamiento-conjunto';
import AnemiaScreening from './well-child-care/components/anemia-screening/anemia-screening.component';
import FeedingCounseling from './well-child-care/components/child-nutrition/feeding-counseling/feeding-counseling.component';
import NutritionFollowup from './well-child-care/components/child-nutrition/nutrition-followup/nutrition-followup.component';
// Child Nutrition Components
import NutritionalAssessment from './well-child-care/components/child-nutrition/nutritional-assessment/nutritional-assessment.component';
import CredControlsCheckout from './well-child-care/components/cred-controls-timeline/cred-checkups.component';
import CredControlsTimeline from './well-child-care/components/cred-controls-timeline/cred-controls-timeline.component';
import CredControlsMatrix from './well-child-care/components/cred-controls-timeline/cred-matrix.component';
import CREDFormActionButton from './well-child-care/components/cred-form-action-button.component';
import DevelopmentOverview from './well-child-care/components/development-overview/development-overview.component';
import StimulationCounseling from './well-child-care/components/early-stimulation/stimulation-counseling/stimulation-counseling.component';
import StimulationFollowup from './well-child-care/components/early-stimulation/stimulation-followup/stimulation-followup.component';
// Early Stimulation Components
import StimulationSessions from './well-child-care/components/early-stimulation/stimulation-sessions/stimulation-sessions.component';
import NeonatalAttention from './well-child-care/components/neonatal-attention/neonatal-attention.component';
import NeonatalCounseling from './well-child-care/components/neonatal-counseling/neonatal-consuling.component';
import NeonatalEvaluation from './well-child-care/components/neonatal-evaluation/neonatal-evaluation.component';
import PregnancyBirthTable from './well-child-care/components/neonatal-register/detalles-embarazo/pregnancy-table.component';
import BirthDataTable from './well-child-care/components/neonatal-register/detalles-nacimiento/birth-date.component';
import LabourHistory from './well-child-care/components/neonatal-register/labour-history/labour-history.component';
import PrenatalAntecedents from './well-child-care/components/neonatal-register/prenatal-history/prenatal-history.component';
import NewbornBalanceOverview from './well-child-care/components/newborn-monitoring/newborn balance/balance-overview.component';
import NewbornBiometricsBase from './well-child-care/components/newborn-monitoring/newborn biometrics/biometrics-base.component';
import ScreeningIndicators from './well-child-care/components/screening/screening-indicators.component';
import SupplementationTracker from './well-child-care/components/supplementation/supplementation-tracker.component';
import VaccinationSchedule from './well-child-care/components/vaccination-schema-widget/vaccinationSchedule.component';
import { EarlyStimulation } from './well-child-care/early-stimulation.component';
import { NeonatalCare } from './well-child-care/neonatal-care.component';
import { WellChildControl } from './well-child-care/well-child-control.component';
import CREDFormsSelectorWorkspace from './well-child-care/workspace/cred-forms-selector.workspace';

const moduleName = '@sihsalus/esm-cred-app';
const options = {
  featureName: 'cred-app',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp(): void {
  defineConfigSchema(moduleName, configSchema);
}

// ================================================================================
// WELL CHILD CARE EXPORTS
// ================================================================================
export const wellChildCareSideNavGroup = getSyncLifecycle(createDashboardGroup(wellChildCareNavGroup), options);

// Navigation Links
export const childImmunizationScheduleLink = getSyncLifecycle(
  createDashboardLink({
    ...childImmunizationScheduleDashboardMeta,
    moduleName,
  }),
  options,
);
export const neonatalCareLink = getSyncLifecycle(
  createDashboardLink({ ...neonatalCareDashboardMeta, moduleName }),
  options,
);
export const wellChildCareLink = getSyncLifecycle(
  createDashboardLink({ ...wellChildControlDashboardMeta, moduleName }),
  options,
);
export const earlyStimulationLink = getSyncLifecycle(
  createDashboardLink({ ...earlyStimulationDashboardMeta, moduleName }),
  options,
);
export const childNutritionLink = getSyncLifecycle(
  createDashboardLink({ ...childNutritionDashboardMeta, moduleName }),
  options,
);

// Main Components
export const childImmunizationSchedule = getSyncLifecycle(ChildImmunizationSchedule, options);
export const neonatalCare = getSyncLifecycle(NeonatalCare, options);
export const wellChildCare = getSyncLifecycle(WellChildControl, options);
export const earlyStimulation = getSyncLifecycle(EarlyStimulation, options);
export const childNutrition = getSyncLifecycle(ChildNutrition, options);

// CRED Controls
export const credCheckouts = getSyncLifecycle(CredControlsCheckout, options);
export const credControls = getSyncLifecycle(CredControlsTimeline, options);
export const credControlsMatrix = getSyncLifecycle(CredControlsMatrix, options);

// Neonatal Components
export const alojamientoConjunto = getSyncLifecycle(AlojamientoConjunto, options);
export const neonatalAttentionChart = getSyncLifecycle(NeonatalAttention, options);
export const neonatalCounselingChart = getSyncLifecycle(NeonatalCounseling, options);
export const neonatalEvaluationChart = getSyncLifecycle(NeonatalEvaluation, options);
export const neonatalRegisterBirth = getSyncLifecycle(BirthDataTable, options);
export const neonatalRegisterChart = getSyncLifecycle(LabourHistory, options);
export const pregnancyDetails = getSyncLifecycle(PregnancyBirthTable, options);

// Newborn Monitoring
export const newbornBalanceOverviewChart = getSyncLifecycle(NewbornBalanceOverview, options);
export const newbornBiometricsBaseChart = getSyncLifecycle(NewbornBiometricsBase, options);

// Vaccination Components
export const vaccinationAppointment = getSyncLifecycle(AdverseReactionsSummary, options);
export const adverseReactionFormWorkspace = getAsyncLifecycle(
  () => import('./well-child-care/workspace/adverse-reaction/adverseReaction.component'),
  options,
);
export const vaccinationSchedule = getSyncLifecycle(VaccinationSchedule, options);

// Child Medical History
export const childMedicalHistory = getSyncLifecycle(ChildMedicalHistory, options);

// CRED Screening & Supplementation Widgets
export const anemiaScreening = getSyncLifecycle(AnemiaScreening, options);
export const supplementationTracker = getSyncLifecycle(SupplementationTracker, options);
export const screeningIndicators = getSyncLifecycle(ScreeningIndicators, options);

// Development Evaluation Overview
export const developmentOverview = getSyncLifecycle(DevelopmentOverview, options);

// Prenatal History (Obstetric Formula — used in neonatal register)
export const prenatalHistory = getSyncLifecycle(PrenatalAntecedents, options);

// CRED Form Action Button
export const credFormActionButton = getSyncLifecycle(CREDFormActionButton, options);

// Generic Slot Placeholder
export const slotPlaceholder = getSyncLifecycle(SlotPlaceholder, options);

// Child Nutrition Widgets
export const nutritionalAssessment = getSyncLifecycle(NutritionalAssessment, options);
export const feedingCounseling = getSyncLifecycle(FeedingCounseling, options);
export const nutritionFollowup = getSyncLifecycle(NutritionFollowup, options);

// Early Stimulation Widgets
export const stimulationSessions = getSyncLifecycle(StimulationSessions, options);
export const stimulationFollowup = getSyncLifecycle(StimulationFollowup, options);
export const stimulationCounseling = getSyncLifecycle(StimulationCounseling, options);

// Hidden Dashboard Route Markers
const HiddenDashboardMarker: React.FC = () => null;
export const hiddenDashboardMarker = getSyncLifecycle(HiddenDashboardMarker, options);

// Async Components
export const growthChart = getAsyncLifecycle(
  () => import('./ui/growth-chart/growth-chart-overview.component'),
  options,
);
export const monthlyAppointmentFilterCalendar = getAsyncLifecycle(
  () => import('./ui/appointment-filter-calendar/appointment-filter-calendar'),
  options,
);
export const newbornAnthropometricsworkspace = getAsyncLifecycle(
  () => import('./well-child-care/workspace/newborn-triage/newborn-anthropometrics.workspace'),
  options,
);
export const newbornFluidBalanceworkspace = getAsyncLifecycle(
  () => import('./well-child-care/workspace/newborn-triage/newborn-fluid-balance.workspace'),
  options,
);
export const perinatalRegisterworkspace = getAsyncLifecycle(
  () => import('./well-child-care/workspace/perinatal-register/perinatal-register-form.workspace'),
  options,
);
export const wellchildControlsworkspace = getAsyncLifecycle(
  () => import('./well-child-care/workspace/well-child-control/well-child-controls-form.workspace'),
  options,
);
export const conditionsFilterWorkspace = getAsyncLifecycle(
  () => import('./ui/conditions-filter/conditions-form.workspace'),
  options,
);
export const conditionFilterDeleteConfirmationDialog = getAsyncLifecycle(
  () => import('./ui/conditions-filter/delete-condition.modal'),
  options,
);
export const genericConditionsOverview = getAsyncLifecycle(
  () => import('./ui/conditions-filter/generic-conditions-overview.component'),
  options,
);
export const antecedentesPatologicos = getAsyncLifecycle(
  () => import('./well-child-care/antecedentes-patologicos.component'),
  options,
);
export const antecedentesPatologicosFormWorkspace = getAsyncLifecycle(
  () => import('./well-child-care/antecedentes-patologicos-form.workspace'),
  options,
);
export const formsSelectorWorkspace = getSyncLifecycle(CREDFormsSelectorWorkspace, options);
export const testPeruanoFormWorkspace = getAsyncLifecycle(
  () => import('./well-child-care/workspace/test-peruano-form/test-peruano-form.component'),
  options,
);
