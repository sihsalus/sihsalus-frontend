import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render } from '@testing-library/react';

import { configSchema, type ConfigObject } from '../../../config-schema';

import HivScreeningEncounters from './tabs/hiv-screening.component';
import HivTestingEncounters from './tabs/hiv-testing.component';

const { mockEncounterList } = vi.hoisted(() => ({
  mockEncounterList: vi.fn(),
}));

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  EncounterList: (props: unknown) => {
    mockEncounterList(props);
    return null;
  },
  getObsFromEncounter: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);

describe('HIV encounter histories', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
  });

  it('shows a read-only screening history and safely ignores encounters without a form', () => {
    const config = getDefaultsFromConfigSchema(configSchema);

    render(<HivScreeningEncounters patientUuid="patient-uuid" />);

    const props = mockEncounterList.mock.calls[0][0];

    expect(props.patientUuid).toBe('patient-uuid');
    expect(props.launchOptions.hideFormLauncher).toBe(true);
    expect(props.columns.some((column) => column.key === 'actions')).toBe(false);
    expect(props.filter({ form: undefined })).toBe(false);
    expect(props.filter({ form: { uuid: config.formsList.htsScreening } })).toBe(true);
  });

  it('shows a read-only testing history and accepts initial tests and retests', () => {
    const config = getDefaultsFromConfigSchema(configSchema);

    render(<HivTestingEncounters patientUuid="patient-uuid" />);

    const props = mockEncounterList.mock.calls[0][0];

    expect(props.launchOptions.hideFormLauncher).toBe(true);
    expect(props.columns.some((column) => column.key === 'actions')).toBe(false);
    expect(props.filter({ form: undefined })).toBe(false);
    expect(props.filter({ form: { uuid: config.formsList.htsInitialTest } })).toBe(true);
    expect(props.filter({ form: { uuid: config.formsList.htsRetest } })).toBe(true);
  });
});
