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
  useGetManyObstreeData: (conceptUuids: string[]) => mockUseGetManyObstreeData(conceptUuids),
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
  it('loads the default filters when only the published laboratory catalog is available', () => {
    // Root UUIDs in the published catalog; the QLTY-only Uroanalisis Grupo is absent.
    const publishedConcepts = new Set([
      '228ced89-758e-4e0b-982e-155c01ed50f7',
      '20df74e8-192d-4c30-8e5c-d9989c8a33d8',
      '8ed15668-238d-4f19-947f-2237cb5d793f',
      '48ea717c-cc7c-4dc1-a018-9c0d439ee178',
      '0a84d7d3-2d86-4415-a12f-dc2a307ddba1',
      '7e750f3a-8d5c-45b1-8e94-ebf850208e35',
      '968c8a41-ab1b-426c-86ee-761b88c26e40',
    ]);
    mockUseGetManyObstreeData.mockImplementation((conceptUuids: string[]) => ({
      roots: [],
      isLoading: false,
      error: conceptUuids.some((uuid) => !publishedConcepts.has(uuid)) ? new Error('Concept not found') : null,
    }));

    render(<RoutedResultsViewer {...testProps} />);

    expect(screen.getByRole('heading', { name: /test results/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /data load error/i })).not.toBeInTheDocument();
    expect(mockUseGetManyObstreeData).toHaveBeenCalledWith(
      expect.arrayContaining(['7e750f3a-8d5c-45b1-8e94-ebf850208e35']),
    );
  });

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

    expect(screen.getAllByText(/complete blood count/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/platelets/i)).toHaveLength(2);

    expect(screen.queryByText(/hematocrit/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hemoglobin/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Serum chemistry panel/i)).not.toBeInTheDocument();

    const checkboxesWithoutData = [
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

    checkboxesWithoutData.forEach((label) => {
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Comprehensive metabolic panel/i })).not.toBeInTheDocument();

    const cbcButtons = screen.getAllByRole('button', { name: /Complete blood count/i });
    expect(cbcButtons.length).toBeGreaterThan(0);

    await userEvent.click(cbcButtons[0]);
    expect(screen.getAllByLabelText(/platelets/i)[0]).toBeVisible();
  });
});
