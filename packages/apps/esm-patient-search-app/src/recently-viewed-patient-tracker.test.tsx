import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render } from '@testing-library/react';

import { configSchema } from './config-schema';
import RecentlyViewedPatientTracker from './recently-viewed-patient-tracker.component';
import { useRecentlyViewedPatients } from './recently-viewed-patients.store';
import routes from './routes.json';

vi.mock('./recently-viewed-patients.store', () => ({
  useRecentlyViewedPatients: vi.fn(),
}));
const recordViewedPatient = vi.fn();

beforeEach(() => {
  vi.mocked(useConfig).mockReturnValue(getDefaultsFromConfigSchema(configSchema));
  vi.mocked(useRecentlyViewedPatients).mockReturnValue({
    recentlyViewedPatientUuids: [],
    cacheGeneration: 1,
    recordViewedPatient,
  });
});

it('records a chart only after the slot patient matches the opened route', () => {
  const { rerender } = render(<RecentlyViewedPatientTracker isPatientChart patientUuid="synthetic-patient-a" />);
  expect(recordViewedPatient).not.toHaveBeenCalled();
  rerender(
    <RecentlyViewedPatientTracker
      isPatientChart
      patientUuid="synthetic-patient-a"
      patient={{ resourceType: 'Patient', id: 'old-patient' }}
    />,
  );
  expect(recordViewedPatient).not.toHaveBeenCalled();
  rerender(
    <RecentlyViewedPatientTracker
      isPatientChart
      patientUuid="synthetic-patient-a"
      patient={{ resourceType: 'Patient', id: 'synthetic-patient-a' }}
    />,
  );
  expect(recordViewedPatient).toHaveBeenCalledWith('synthetic-patient-a');
  rerender(
    <RecentlyViewedPatientTracker
      isPatientChart
      patientUuid="synthetic-patient-b"
      patient={{ resourceType: 'Patient', id: 'synthetic-patient-b' }}
    />,
  );
  expect(recordViewedPatient).toHaveBeenLastCalledWith('synthetic-patient-b');
});

it('does not copy a chart still mounted from a previous session into the next account', () => {
  const props = {
    isPatientChart: true,
    patientUuid: 'synthetic-patient-a',
    patient: { resourceType: 'Patient' as const, id: 'synthetic-patient-a' },
  };
  const { rerender } = render(<RecentlyViewedPatientTracker {...props} />);
  recordViewedPatient.mockClear();
  vi.mocked(useRecentlyViewedPatients).mockReturnValue({
    recentlyViewedPatientUuids: [],
    cacheGeneration: 2,
    recordViewedPatient,
  });
  rerender(<RecentlyViewedPatientTracker {...props} />);
  expect(recordViewedPatient).not.toHaveBeenCalled();
});

it('passes the disabled feature flag to the store and keeps the chart slot privilege', () => {
  const config = getDefaultsFromConfigSchema(configSchema);
  vi.mocked(useConfig).mockReturnValue({
    ...config,
    search: { ...config.search, showRecentlySearchedPatients: false },
  });
  render(<RecentlyViewedPatientTracker />);
  expect(useRecentlyViewedPatients).toHaveBeenCalledWith(false);
  expect(routes.extensions.find(({ name }) => name === 'recently-viewed-patient-tracker')).toMatchObject({
    slot: 'patient-header-slot',
    privileges: 'app:hoja.clinica',
    component: 'recentlyViewedPatientTracker',
  });
});
