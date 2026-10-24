import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useWatch } from 'react-hook-form';
import { ensureEncounterRoleField } from '../../../processors/encounter/encounter-role-field';
import { useFormProviderContext } from '../../../provider/form-provider';
import { getRegisteredDataSource } from '../../../registry/registry';
import { type FormField, type FormSchema } from '../../../types';
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

    // The resolved item is applied in a promise callback, so the skeleton is
    // still mounted right after the fetch call. Query asynchronously to wait
    // for the ComboBox to replace it.
    expect(await screen.findByRole('combobox')).toHaveValue('Consultorio actual');
  });
  it.each(['explicit', 'generated'])('opens the %s role catalog and preserves the selected role', async (source) => {
    mockUseWatch.mockReturnValue(undefined as never);
    const roles = [
      { uuid: 'nurse', display: 'Enfermería Responsable' },
      { uuid: 'doctor', display: 'Médico Responsable' },
    ];
    const fetchData = vi.fn().mockResolvedValue(roles);
    mockGetRegisteredDataSource.mockResolvedValue({
      fetchData,
      fetchSingleItem,
      toUuidAndDisplay: (item) => item,
    } as never);
    const setFieldValue = vi.fn();
    let field = {
      id: 'role',
      label: 'Rol',
      type: 'encounterRole',
      meta: {},
      questionOptions: { rendering: 'encounter-role', isSearchable: false },
    } as FormField;
    if (source === 'generated') {
      const schema = {
        pages: [{ id: 'social', sections: [{ questions: [] }] }],
      } as FormSchema;
      ensureEncounterRoleField(schema);
      field = schema.pages[0].sections[0].questions[0];
    }
    render(
      <UiSelectExtended errors={[]} warnings={[]} setFieldValue={setFieldValue} value={undefined} field={field} />,
    );
    await waitFor(() => expect(fetchData).toHaveBeenCalled());
    await userEvent.click(await screen.findByRole('button', { name: /open/i }));
    await userEvent.click(await screen.findByText('Enfermería Responsable'));
    expect(setFieldValue).toHaveBeenCalledWith('nurse');
  });
});
