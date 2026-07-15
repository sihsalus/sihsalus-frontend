import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import {
  createClinicalDashboardGroup as createDashboardGroup,
  createDashboardLink,
} from '@openmrs/esm-patient-common-lib';
import type React from 'react';

import { configSchema } from './config-schema';

// Maternal and Child Health Components
import { CancerPrevention } from './maternal-and-child-health/cancer-prevention.component';
import BreastScreening from './maternal-and-child-health/components/cancer-prevention/breast-screening/breast-screening.component';
import CancerFollowup from './maternal-and-child-health/components/cancer-prevention/cancer-followup/cancer-followup.component';
import CervicalScreening from './maternal-and-child-health/components/cancer-prevention/cervical-screening/cervical-screening.component';
import ContraceptiveMethods from './maternal-and-child-health/components/family-planning/contraceptive-methods/contraceptive-methods.component';
import FpCounseling from './maternal-and-child-health/components/family-planning/fp-counseling/fp-counseling.component';
import FpFollowup from './maternal-and-child-health/components/family-planning/fp-followup/fp-followup.component';
import DeliveryOrAbortionTable from './maternal-and-child-health/components/labour-delivery/deliveryOrAbortion.component';
import SummaryOfLaborAndPostpartumTable from './maternal-and-child-health/components/labour-delivery/summaryOfLaborAndPostpartum.component';
import ImmediatePostpartumTable from './maternal-and-child-health/components/postnatal-care/immediatePostpartum.component';
import PostpartumTrackingWidget from './maternal-and-child-health/components/postnatal-care/postpartum-tracking.component';
import PostpartumControlTable from './maternal-and-child-health/components/postnatal-care/postpartumControl.component';
import BirthPlanWidget from './maternal-and-child-health/components/prenatal-care/birth-plan/birth-plan.component';
import CurrentPregnancyTable from './maternal-and-child-health/components/prenatal-care/currentPregnancy.component';
import MaternalHistoryTable from './maternal-and-child-health/components/prenatal-care/maternalHistory.component';
import PrenatalSupplementationWidget from './maternal-and-child-health/components/prenatal-care/prenatal-supplementation/prenatal-supplementation.component';
import PrenatalCareChart from './maternal-and-child-health/components/prenatal-care/prenatalCareChart.component';
import PsychoprophylaxisWidget from './maternal-and-child-health/components/prenatal-care/psychoprophylaxis/psychoprophylaxis.component';
import RiskClassification from './maternal-and-child-health/components/prenatal-care/risk-classification/risk-classification.component';
import {
  cancerPreventionDashboardMeta,
  familyPlanningDashboardMeta,
  labourAndDeliveryDashboardMeta,
  maternalAndChildHealthNavGroup,
  postnatalDashboardMeta,
  prenatalDashboardMeta,
} from './maternal-and-child-health/dashboard.meta';
import { FamilyPlanning } from './maternal-and-child-health/family-planning.component';
import { LabourDelivery } from './maternal-and-child-health/labour-delivery.component';
import { PostnatalCare } from './maternal-and-child-health/postnatal-care.component';
import { PrenatalCare } from './maternal-and-child-health/prenatal-care.component';
import MaternalHealthFormsSelectorWorkspace from './maternal-and-child-health/workspace/maternal-health-forms-selector.workspace';
import { ObstetricHistoryBase } from './ui/obstetric-history-widget';
import Partograph from './ui/partography/partograph.component';

const moduleName = '@sihsalus/esm-salud-materna-app';
const options = {
  featureName: 'salud-materna-app',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp(): void {
  defineConfigSchema(moduleName, configSchema);
}

// ================================================================================
// MATERNAL AND CHILD HEALTH EXPORTS
// ================================================================================
export const maternalAndChildHealthSideNavGroup = getSyncLifecycle(
  createDashboardGroup(maternalAndChildHealthNavGroup),
  options,
);

// Navigation Links
export const labourAndDeliveryLink = getSyncLifecycle(
  createDashboardLink({ ...labourAndDeliveryDashboardMeta, moduleName }),
  options,
);
export const postnatalCareLink = getSyncLifecycle(
  createDashboardLink({ ...postnatalDashboardMeta, moduleName }),
  options,
);
export const prenatalCareLink = getSyncLifecycle(
  createDashboardLink({ ...prenatalDashboardMeta, moduleName }),
  options,
);
export const familyPlanningLink = getSyncLifecycle(
  createDashboardLink({ ...familyPlanningDashboardMeta, moduleName }),
  options,
);
export const cancerPreventionLink = getSyncLifecycle(
  createDashboardLink({ ...cancerPreventionDashboardMeta, moduleName }),
  options,
);

// Main Components
export const labourAndDelivery = getSyncLifecycle(LabourDelivery, options);
export const postnatalCare = getSyncLifecycle(PostnatalCare, options);
export const prenatalCare = getSyncLifecycle(PrenatalCare, options);
export const familyPlanning = getSyncLifecycle(FamilyPlanning, options);
export const cancerPrevention = getSyncLifecycle(CancerPrevention, options);
export const maternalHealthFormsSelectorWorkspace = getSyncLifecycle(MaternalHealthFormsSelectorWorkspace, options);

// Labour & Delivery Components
export const deliveryOrAbortionTable = getSyncLifecycle(DeliveryOrAbortionTable, options);
export const partograph = getSyncLifecycle(Partograph, options);
export const summaryOfLaborAndPostpartumTable = getSyncLifecycle(SummaryOfLaborAndPostpartumTable, options);

// Obstetric History
export const obstetricHistoryChart = getSyncLifecycle(ObstetricHistoryBase, options);

// Postnatal Care Components
export const immediatePostpartumTable = getSyncLifecycle(ImmediatePostpartumTable, options);
export const postpartumControlTable = getSyncLifecycle(PostpartumControlTable, options);
export const postpartumTracking = getSyncLifecycle(PostpartumTrackingWidget, options);

// Prenatal Care Components
export const currentPregnancyTable = getSyncLifecycle(CurrentPregnancyTable, options);
export const maternalHistoryTable = getSyncLifecycle(MaternalHistoryTable, options);
export const prenatalCareChart = getSyncLifecycle(PrenatalCareChart, options);
export const birthPlan = getSyncLifecycle(BirthPlanWidget, options);
export const riskClassification = getSyncLifecycle(RiskClassification, options);
export const psychoprophylaxis = getSyncLifecycle(PsychoprophylaxisWidget, options);
export const prenatalSupplementation = getSyncLifecycle(PrenatalSupplementationWidget, options);

// Family Planning Widgets
export const contraceptiveMethods = getSyncLifecycle(ContraceptiveMethods, options);
export const fpCounseling = getSyncLifecycle(FpCounseling, options);
export const fpFollowup = getSyncLifecycle(FpFollowup, options);

// Cancer Prevention Widgets
export const cervicalScreening = getSyncLifecycle(CervicalScreening, options);
export const breastScreening = getSyncLifecycle(BreastScreening, options);
export const cancerFollowup = getSyncLifecycle(CancerFollowup, options);

// Hidden Dashboard Route Markers
const HiddenDashboardMarker: React.FC = () => null;
export const hiddenDashboardMarker = getSyncLifecycle(HiddenDashboardMarker, options);

// Async Components
export const alturaUterinaChart = getAsyncLifecycle(
  () => import('./ui/alturaCuello-chart/altura-cuello-overview.component'),
  options,
);
export const monthlyAppointmentFilterCalendar = getAsyncLifecycle(
  () => import('./ui/appointment-filter-calendar/appointment-filter-calendar'),
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
