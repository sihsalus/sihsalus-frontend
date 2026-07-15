import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockResults } from 'test-utils';

import { type ConfigObject, configSchema } from '../../config-schema';
import RoutedResultsViewer from './results-viewer.extension';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseGetManyObstreeData = vi.fn();

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useParams: vi.fn(() => ({})),
}));

vi.mock('../grouped-timeline', async () => ({
  ...(await vi.importActual('../grouped-timeline')),
  useGetManyObstreeData: () => mockUseGetManyObstreeData(),
}));

const testProps = {
  basePath: '/spa/patient/some-uuid/chart/Results',
  patientUuid: 'some-uuid',
};

mockUseConfig.mockReturnValue({
  ...getDefaultsFromConfigSchema(configSchema),
});

global.IntersectionObserver = vi.fn(function (callback, options) {
  this.observe = vi.fn();
  this.unobserve = vi.fn();
  this.disconnect = vi.fn();
  this.trigger = (entries) => callback(entries, this);
  this.options = options;
}) as unknown as typeof IntersectionObserver;

describe('ResultsViewer', () => {
  it('should return an empty state when there is no data', async () => {
    mockUseGetManyObstreeData.mockReturnValue({
      roots: [],
      isLoading: false,
      error: null,
    });
    render(<RoutedResultsViewer {...testProps} />);

    const testResultsText = screen.getByRole('heading', { name: /test results/i });
    expect(testResultsText).toBeInTheDocument();
    expect(screen.getByText(/empty data illustration/i)).toBeInTheDocument();
    expect(screen.getByText(/There are no test results data to display for this patient/i)).toBeInTheDocument();
  });

  it('should return an error state when there is an error', async () => {
    mockUseGetManyObstreeData.mockReturnValue({
      roots: [],
      isLoading: false,
      error: new Error('An error occurred'),
    });
    render(<RoutedResultsViewer {...testProps} />);

    const testResultsText = screen.getByRole('heading', { name: /data load error/i });
    expect(testResultsText).toBeInTheDocument();
    expect(screen.getByText(/there was a problem displaying this information/i)).toBeInTheDocument();
  });

  it('should render the Tree wrapper component component', async () => {
    mockUseGetManyObstreeData.mockReturnValue({
      roots: mockResults,
      isLoading: false,
      error: null,
    });
    render(<RoutedResultsViewer {...testProps} />);

    expect(screen.getAllByText(/complete blood count/i)).toHaveLength(2);
    expect(screen.getAllByText(/hematocrit/i)).toHaveLength(2);
    expect(screen.getAllByText(/hemoglobin/i)).toHaveLength(4);
    const mainLabel = screen.getByLabelText(/Serum chemistry panel/i);
    expect(mainLabel).toBeInTheDocument();

    const checkboxes = [
      'Serum glucose',
      'Fasting blood glucose measurement (mg/dL)',
      'Post-prandial blood glucose measurement (mg/dL)',
      'Blood urea nitrogen',
      'Serum creatinine (umol/L)',
      'Total bilirubin',
      'Serum glutamic-pyruvic transaminase',
      'Serum glutamic-oxaloacetic transaminase',
      'Alkaline phosphatase',
      'uric acid, serum',
      'Total protein',
      'Serum albumin',
      'Total cholesterol (mmol/L)',
      'Triglycerides (mmol/L)',
      'Amylase',
      'Serum sodium',
      'Serum potassium',
      'Serum calcium',
    ];

    checkboxes.forEach((label) => {
      const checkboxes = screen.getAllByLabelText(label);
      checkboxes.forEach((checkbox) => {
        expect(checkbox).toBeInTheDocument();
        expect(checkbox).toBeDisabled();
      });
    });

    const panelButton = screen.getByRole('button', { name: /Comprehensive metabolic panel/i });
    expect(panelButton).toBeInTheDocument();

    await userEvent.click(panelButton);
    expect(screen.getByText(/Comprehensive metabolic panel/i)).toBeVisible();
  });
});
