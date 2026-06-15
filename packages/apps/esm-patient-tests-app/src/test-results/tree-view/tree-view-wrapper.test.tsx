import { getDefaultsFromConfigSchema, useConfig, useLayoutType, usePatient } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { mockGroupedResults, mockPatient, mockResults } from 'test-utils';

import { type ConfigObject, configSchema } from '../../config-schema';
import FilterContext from '../filter/filter-context';
import { type FilterContextProps } from '../filter/filter-types';
import { useGetManyObstreeData } from '../grouped-timeline';

import TreeViewWrapper from './tree-view-wrapper.component';

const mockUsePatient = vi.mocked(usePatient);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockUseGetManyObstreeData = vi.mocked(useGetManyObstreeData);
const mockFhirPatient = mockPatient as unknown as fhir.Patient;

vi.mock('../panel-timeline/helpers', async () => ({
  ...(await vi.importActual('../panel-timeline/helpers')),
  parseTime: vi.fn(),
}));

vi.mock('../grouped-timeline', async () => ({
  ...(await vi.importActual('../grouped-timeline')),
  useGetManyObstreeData: vi.fn(),
}));

const mockProps = {
  patientUuid: 'test-patient-uuid',
  basePath: '/test-base-path',
  testUuid: 'test-uuid',
  expanded: false,
  type: 'default',
  view: 'individual-test' as const,
};

const mockFilterContext: FilterContextProps = {
  activeTests: ['Bloodwork-Chemistry', 'Bloodwork'],
  timelineData: mockGroupedResults.timelineData,
  tableData: null,
  parents: mockGroupedResults.parents,
  checkboxes: { Bloodwork: false, Chemistry: true },
  someChecked: true,
  lowestParents: mockGroupedResults['lowestParents'],
  totalResultsCount: 0,
  initialize: vi.fn(),
  toggleVal: vi.fn(),
  updateParent: vi.fn(),
  resetTree: vi.fn(),
  roots: mockResults as any,
  tests: {},
};

const renderTreeViewWrapperWithMockContext = (contextValue = mockFilterContext) => {
  render(
    <FilterContext.Provider value={contextValue}>
      <TreeViewWrapper {...mockProps} />
    </FilterContext.Provider>,
  );
};

describe('TreeViewWrapper', () => {
  beforeEach(() => {
    mockUseLayoutType.mockReturnValue('small-desktop');

    mockUsePatient.mockReturnValue({
      patient: mockFhirPatient,
      patientUuid: mockPatient.id,
      isLoading: false,
      error: null,
    });

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      resultsViewerConcepts: [
        {
          conceptUuid: '9a6f10d6-7fc5-4fb7-9428-24ef7b8d01f7',
          defaultOpen: true,
        },
        {
          conceptUuid: '856AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          defaultOpen: true,
        },
        {
          conceptUuid: '1015AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          defaultOpen: false,
        },
      ],
      orders: {
        labOrderTypeUuid: '52a447d3-a64a-11e3-9aeb-50e549534c5e',
        labOrderableConcepts: ['1748a953-d12e-4be1-914c-f6b096c6cdef'],
      },
      additionalTestOrderTypes: [],
      labTestsWithOrderReasons: [],
    });
  });

  it('renders an empty state view when there is no data', () => {
    mockUseGetManyObstreeData.mockReturnValue({
      roots: [],
      isLoading: false,
      error: null,
    });

    render(<TreeViewWrapper {...mockProps} />);

    expect(screen.getByRole('heading', { name: /test results/i })).toBeInTheDocument();
    expect(screen.getByText(/there are no test results data to display for this patient/i)).toBeInTheDocument();
  });

  it('renders an error state when there is an error', () => {
    const mockError = new Error('Test error');
    mockUseGetManyObstreeData.mockReturnValue({
      roots: [],
      isLoading: false,
      error: mockError,
    });

    render(<TreeViewWrapper {...mockProps} />);

    expect(screen.getByRole('heading', { name: /data load error/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        /sorry, there was a problem displaying this information. you can try to reload this page, or contact the site administrator and quote the error code above./i,
      ),
    ).toBeInTheDocument();
  });

  it('renders the tree view when test data is successfully fetched', async () => {
    mockUseGetManyObstreeData.mockReturnValue({
      roots: mockResults as any,
      isLoading: false,
      error: null,
    });

    renderTreeViewWrapperWithMockContext();

    expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Complete blood count').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Haemoglobin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hematocrit').length).toBeGreaterThan(0);
  });
});
