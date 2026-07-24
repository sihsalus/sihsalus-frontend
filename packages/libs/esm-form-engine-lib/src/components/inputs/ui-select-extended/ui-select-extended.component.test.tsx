import { render, screen, waitFor } from '@testing-library/react';
import { useWatch } from 'react-hook-form';
import { useFormProviderContext } from '../../../provider/form-provider';
import { getRegisteredDataSource } from '../../../registry/registry';
import UiSelectExtended from './ui-select-extended.component';

vi.mock('react-hook-form', () => ({
  useWatch: vi.fn(),
}));

vi.mock('../../../hooks/useDataSourceDependentValue', () => ({
  default: vi.fn(() => undefined),
}));

vi.mock('../../../provider/form-provider', () => ({
  useFormProviderContext: vi.fn(),
}));

vi.mock('../../../registry/registry', () => ({
  getRegisteredDataSource: vi.fn(),
}));

const mockUseWatch = vi.mocked(useWatch);
const mockUseFormProviderContext = vi.mocked(useFormProviderContext);
const mockGetRegisteredDataSource = vi.mocked(getRegisteredDataSource);
const fetchSingleItem = vi.fn();

describe('UiSelectExtended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWatch.mockReturnValue('current-location-uuid' as never);
    mockUseFormProviderContext.mockReturnValue({
      layoutType: 'desktop',
      methods: {
        control: {},
        getFieldState: () => ({ isDirty: false }),
      },
      sessionMode: 'enter',
      workspaceLayout: 'minimized',
    } as never);
    fetchSingleItem.mockResolvedValue({
      uuid: 'current-location-uuid',
      display: 'Consultorio actual',
    });
    mockGetRegisteredDataSource.mockResolvedValue({
      fetchData: vi.fn(),
      fetchSingleItem,
      toUuidAndDisplay: (item) => item,
    } as never);
  });

  it('resolves and displays a searchable default value while creating an encounter', async () => {
    render(
      <UiSelectExtended
        errors={[]}
        field={
          {
            id: 'encounterLocation',
            isHidden: false,
            label: 'Consultorio / Servicio',
            meta: {},
            questionOptions: {
              datasource: { name: 'location_datasource' },
              isSearchable: true,
              rendering: 'encounter-location',
            },
            type: 'encounterLocation',
          } as never
        }
        setFieldValue={vi.fn()}
        value="current-location-uuid"
        warnings={[]}
      />,
    );

    await waitFor(() => expect(fetchSingleItem).toHaveBeenCalledWith('current-location-uuid'));

    expect(screen.getByRole('combobox')).toHaveValue('Consultorio actual');
  });
});
