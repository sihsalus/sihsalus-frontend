// Adapted from OpenMRS patient-chart 54e48e8f97ee116b97829f2b9df66c699d27dd4d (MPL-2.0).
import { LineChart } from '@carbon/charts-react';
import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type ConfigObject, configSchema } from '../config-schema';
import { type UseObsResult, useObs } from '../resources/useObs';
import ObsSwitchable from './obs-switchable.component';

vi.mock('../resources/useObs', () => ({ useObs: vi.fn() }));
// Rendering and table controls stay real; only the external chart renderer is isolated.
vi.mock('@carbon/charts-react', () => ({ LineChart: vi.fn(() => <div role="img" aria-label="Observation graph" />) }));

const mockUseObs = vi.mocked(useObs);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockChart = vi.mocked(LineChart);
const weight = '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const note = '164162AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
let config: ConfigObject;
let observations: UseObsResult['data'];
let hookResult: UseObsResult;

beforeEach(() => {
  vi.clearAllMocks();
  config = {
    ...getDefaultsFromConfigSchema<ConfigObject>(configSchema),
    title: 'Synthetic observations',
    data: [
      { concept: weight, label: 'Weight', color: 'blue' },
      { concept: note, label: 'Note', color: 'red' },
    ],
  };
  observations = [
    {
      resourceType: 'Observation',
      status: 'final',
      id: 'synthetic-weight-new',
      code: {},
      conceptUuid: weight,
      dataType: 'Number',
      effectiveDateTime: '2021-02-01T00:00:00Z',
      valueQuantity: { value: 72 },
      encounter: { reference: 'Encounter/synthetic-new' },
    },
    {
      resourceType: 'Observation',
      status: 'final',
      id: 'synthetic-weight-old',
      code: {},
      conceptUuid: weight,
      dataType: 'Number',
      effectiveDateTime: '2021-01-01T00:00:00Z',
      valueQuantity: { value: 70 },
      encounter: { reference: 'Encounter/synthetic-old' },
    },
    {
      resourceType: 'Observation',
      status: 'final',
      id: 'synthetic-note',
      code: {},
      conceptUuid: note,
      dataType: 'Text',
      effectiveDateTime: '2021-01-01T00:00:00Z',
      valueString: 'Synthetic note',
      encounter: { reference: 'Encounter/synthetic-old' },
    },
  ];
  mockUseConfig.mockReturnValue(config);
  hookResult = {
    data: observations,
    concepts: [],
    encounters: [],
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn(),
  };
  mockUseObs.mockReturnValue(hookResult);
});

describe('ObsSwitchable', () => {
  it('renders the configured observation columns and switches between the real table and numeric graph', async () => {
    const user = userEvent.setup();
    render(<ObsSwitchable patientUuid="synthetic-patient" />);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: /Weight/ })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /Note/ })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '72' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '70' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'Synthetic note' })).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: 'Chart View' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(mockChart.mock.calls.at(-1)?.[0].data).toEqual([
      expect.objectContaining({ group: 'Weight', value: 72 }),
      expect.objectContaining({ group: 'Weight', value: 70 }),
    ]);
    await user.click(screen.getByRole('button', { name: 'Table View' }));
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('respects graph defaults and plots oldest values first without reordering the observations', () => {
    config.showGraphByDefault = true;
    config.graphOldestFirst = true;
    render(<ObsSwitchable patientUuid="synthetic-patient" />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(mockChart.mock.calls.at(-1)?.[0].data).toEqual([
      expect.objectContaining({ value: 70 }),
      expect.objectContaining({ value: 72 }),
    ]);
    expect(observations[0].valueQuantity.value).toBe(72);
  });

  it('keeps text-only observations in the table even when graph is the default', () => {
    config.showGraphByDefault = true;
    mockUseObs.mockReturnValue({ ...hookResult, data: [observations[2]] });
    render(<ObsSwitchable patientUuid="synthetic-patient" />);
    expect(screen.getByRole('cell', { name: 'Synthetic note' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chart View' })).not.toBeInTheDocument();
    expect(mockChart).not.toHaveBeenCalled();
  });

  it('keeps observations without an encounter in separate rows', () => {
    observations[0].encounter = undefined;
    observations[1].encounter = undefined;
    render(<ObsSwitchable patientUuid="synthetic-patient" />);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByRole('cell', { name: '72' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '70' })).toBeInTheDocument();
  });

  it('shows a loading state before data arrives', () => {
    mockUseObs.mockReturnValue({ ...hookResult, data: [], isLoading: true });
    render(<ObsSwitchable patientUuid="synthetic-patient" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows an empty state when the patient has no observations', () => {
    mockUseObs.mockReturnValue({ ...hookResult, data: [] });
    render(<ObsSwitchable patientUuid="synthetic-patient" />);
    expect(screen.getByText('There are no results to display for this patient')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(mockChart).not.toHaveBeenCalled();
  });

  it('shows the error state without leaking the fetch error or stale observations', () => {
    const error = new Error('SYNTHETIC_INTERNAL_FAILURE');
    mockUseObs.mockReturnValue({ ...hookResult, error });
    render(<ObsSwitchable patientUuid="synthetic-patient" />);
    expect(screen.getByRole('heading', { name: 'Synthetic observations' })).toBeInTheDocument();
    expect(screen.getByText(/There was a problem displaying this information/)).toBeInTheDocument();
    expect(screen.queryByText('SYNTHETIC_INTERNAL_FAILURE')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(mockChart).not.toHaveBeenCalled();
  });
});
