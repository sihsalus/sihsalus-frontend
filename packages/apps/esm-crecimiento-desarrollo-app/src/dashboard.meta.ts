const moduleName = '@sihsalus/esm-cred-app';

export const integratedCredDashboardMeta = {
  icon: 'omrs-icon-baby',
  slot: 'patient-chart-cred-dashboard-slot',
  title: 'CRED',
  path: 'cred-dashboard',
  moduleName,
  config: {},
} as const;

export const neonatalCareDashboardMeta = {
  icon: 'omrs-icon-baby',
  slot: 'patient-chart-neonatal-care-dashboard-slot',
  title: 'Curso de Vida del Niño',
  path: 'neonatal-care-dashboard',
  moduleName,
  config: {},
} as const;

export const wellChildControlDashboardMeta = {
  icon: 'omrs-icon-calendar-heat-map',
  slot: 'patient-chart-well-child-care-dashboard-slot',
  title: 'Control de Niño Sano',
  path: 'well-child-care-dashboard',
  moduleName,
  config: {},
} as const;

export const childImmunizationScheduleDashboardMeta = {
  icon: 'omrs-icon-syringe',
  slot: 'patient-chart-child-immunization-schedule-dashboard-slot',
  title: 'Esquema de Vacunación Infantil',
  path: 'child-immunization-schedule-dashboard',
  moduleName,
  config: {},
} as const;

export const earlyStimulationDashboardMeta = {
  icon: 'omrs-icon-baby',
  slot: 'patient-chart-early-stimulation-dashboard-slot',
  title: 'Estimulación Temprana',
  path: 'early-stimulation-dashboard',
  moduleName,
  config: {},
} as const;

export const childNutritionDashboardMeta = {
  icon: 'omrs-icon-medication',
  slot: 'patient-chart-child-nutrition-dashboard-slot',
  title: 'Nutrición Infantil',
  path: 'child-nutrition-dashboard',
  moduleName,
  config: {},
} as const;

export const wellChildCareNavGroup = {
  title: 'Curso de Vida del Niño',
  slotName: 'well-child-care-slot',
  isExpanded: true,
  showWhenExpression: 'enrollment.includes("Control de Niño Sano")',
};
