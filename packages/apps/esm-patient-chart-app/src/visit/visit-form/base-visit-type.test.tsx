import { useVisitTypes } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockVisitTypes } from 'test-utils';

import BaseVisitType from './base-visit-type.component';

vi.mock('lodash-es/debounce', async () => vi.fn((fn) => fn));

const mockUseVisitTypes = vi.mocked(useVisitTypes);
const mockOnChange = vi.fn();

vi.mock('react-hook-form', async () => ({
  ...(await vi.importActual('react-hook-form')),
  useFormContext: vi.fn().mockImplementation(() => ({
    handleSubmit: () => vi.fn(),
    control: {
      register: vi.fn(),
      unregister: vi.fn(),
      getFieldState: vi.fn(),
      _names: {
        array: new Set('test'),
        mount: new Set('test'),
        unMount: new Set('test'),
        watch: new Set('test'),
        focus: 'test',
        watchAll: false,
      },
      _subjects: {
        watch: vi.fn(),
        array: vi.fn(),
        state: vi.fn(),
      },
      _getWatch: vi.fn(),
      _formValues: [],
      _defaultValues: [],
    },
    getValues: () => {
      return [];
    },
    setValue: () => vi.fn(),
    formState: () => vi.fn(),
    watch: () => vi.fn(),
  })),
  Controller: ({ render }) =>
    render({
      field: {
        onChange: mockOnChange,
        onBlur: vi.fn(),
        value: '',
        ref: vi.fn(),
      },
      formState: {
        isSubmitted: false,
      },
      fieldState: {
        isTouched: false,
      },
    }),
  useSubscribe: () => ({
    r: { current: { subject: { subscribe: () => vi.fn() } } },
  }),
}));

describe('VisitTypeOverview', () => {
  beforeEach(() => {
    mockOnChange.mockReset();
  });

  const renderVisitTypeOverview = () => {
    mockUseVisitTypes.mockReturnValue(mockVisitTypes);
    render(<BaseVisitType visitTypes={mockVisitTypes} />);
  };

  it('renders every configured care type in a flat selector', async () => {
    const user = userEvent.setup();
    renderVisitTypeOverview();

    const visitTypeDropdown = screen.getByRole('combobox', {
      name: /tipo de atención/i,
    });
    expect(visitTypeDropdown).toBeInTheDocument();

    await user.click(visitTypeDropdown);

    mockVisitTypes.forEach((visitType) => {
      expect(screen.getByText(visitType.display)).toBeInTheDocument();
    });
  });

  it('selects the configured care type UUID', async () => {
    const user = userEvent.setup();

    renderVisitTypeOverview();

    await user.click(screen.getByRole('combobox', { name: /tipo de atención/i }));
    await user.click(screen.getByText('Outpatient Visit'));

    expect(mockOnChange).toHaveBeenCalledWith('some-uuid1');
  });
});
