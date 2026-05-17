export const htsDashboardMeta = {
  icon: 'omrs-icon-group',
  slot: 'patient-chart-hts-dashboard-slot',
  columns: 1,
  title: 'hivTestingServices',
  path: 'vih-hts-dashboard',
} as const;

export const defaulterTracingDashboardMeta = {
  icon: 'omrs-icon-group',
  slot: 'patient-chart-defaulter-tracing-dashboard-slot',
  columns: 1,
  title: 'defaulterTracing',
  path: 'vih-defaulter-tracing-dashboard',
} as const;

export const hivCareAndTreatmentNavGroup = {
  icon: 'omrs-icon-group',
  title: 'priorityConditionMonitoring',
  slotName: 'hiv-care-and-treatment-slot',
  isExpanded: false,
  isChild: true,
} as const;
