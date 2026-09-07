import { getDefaultsFromConfigSchema, openmrsFetch, useConfig, useSession, type Visit } from '@openmrs/esm-framework';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFhirPatient } from 'test-utils';
import { type ConfigObject, configSchema } from '../../config-schema';
import DrugSearch from './drug-search.component';

const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseSession = vi.mocked(useSession);
const defaultSessionImplementation = mockUseSession.getMockImplementation();
const mockOpenOrderForm = vi.fn();
const mockCloseWorkspace = vi.fn();
const mockOnSearchTermChange = vi.fn();

vi.mock('./order-basket-search-results.component', () => ({
  default: ({ searchTerm }: { searchTerm: string }) => <div data-testid="drug-search-term">{searchTerm}</div>,
}));

const renderDrugSearch = (searchTerm = '') =>
  render(
    <DrugSearch
      openOrderForm={mockOpenOrderForm}
      closeWorkspace={mockCloseWorkspace}
      patient={mockFhirPatient}
      visit={null}
      searchTerm={searchTerm}
      onSearchTermChange={mockOnSearchTermChange}
    />,
  );

describe('DrugSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockImplementation(defaultSessionImplementation);
    mockUseConfig.mockReturnValue({
      ...(getDefaultsFromConfigSchema(configSchema) as ConfigObject),
      minimumCharacterLengthForDrugSearch: 3,
    });
  });

  it('does not pass short search terms to the results query', () => {
    renderDrugSearch('as');

    expect(screen.getByTestId('drug-search-term')).toHaveTextContent('');
  });

  it('passes search terms that meet the configured minimum length', () => {
    renderDrugSearch('asp');

    expect(screen.getByTestId('drug-search-term')).toHaveTextContent('asp');
  });

  it('trims search terms before querying', () => {
    renderDrugSearch('  aspirin  ');

    expect(screen.getByTestId('drug-search-term')).toHaveTextContent('aspirin');
  });

  it('calls onSearchTermChange when the user types', async () => {
    const user = userEvent.setup();

    renderDrugSearch();
    await user.type(screen.getByRole('searchbox'), 'asp');

    expect(mockOnSearchTermChange).toHaveBeenCalled();
  });

  it('offers a separate catalog request draft without creating a prescription', async () => {
    const user = userEvent.setup();
    renderDrugSearch();

    await user.click(screen.getByRole('button', { name: 'Cannot find a medication or supply?' }));
    expect(screen.getByText(/not a prescription/)).toBeVisible();
    await user.type(screen.getByRole('textbox', { name: 'Item to request' }), 'Synthetic catalog item');

    expect(mockOpenOrderForm).not.toHaveBeenCalled();
    expect(mockCloseWorkspace).not.toHaveBeenCalled();
    expect(mockOnSearchTermChange).not.toHaveBeenCalled();
  });

  it.each(['patient', 'consultation', 'account'] as const)('discards the draft on a %s change', async (context) => {
    const user = userEvent.setup();
    const props = {
      openOrderForm: mockOpenOrderForm,
      closeWorkspace: mockCloseWorkspace,
      patient: mockFhirPatient,
      visit: { uuid: 'synthetic-visit-a' } as Visit,
      searchTerm: '',
      onSearchTermChange: mockOnSearchTermChange,
    };
    const { rerender } = render(<DrugSearch {...props} />);
    await user.click(screen.getByRole('button', { name: 'Cannot find a medication or supply?' }));
    await user.type(screen.getByRole('textbox', { name: 'Item to request' }), 'Synthetic draft from prior context');

    if (context === 'patient') props.patient = { ...mockFhirPatient, id: 'synthetic-patient-b' };
    if (context === 'consultation') props.visit = { uuid: 'synthetic-visit-b' } as Visit;
    if (context === 'account') {
      mockUseSession.mockReturnValue({
        ...mockUseSession(),
        user: { ...mockUseSession()?.user, uuid: 'synthetic-user-b' },
      });
    }
    rerender(<DrugSearch {...props} />);

    await user.click(screen.getByRole('button', { name: 'Cannot find a medication or supply?' }));
    expect(screen.getByRole('textbox', { name: 'Item to request' })).toHaveValue('');
    expect(screen.queryByRole('textbox', { name: 'Draft for review (not sent)' })).not.toBeInTheDocument();
    expect(mockOpenOrderForm).not.toHaveBeenCalled();
  });

  describe('pending clipboard completion after a context change', () => {
    afterEach(() => vi.restoreAllMocks());

    it.each([
      ['patient', 'resolves'],
      ['patient', 'rejects'],
      ['consultation', 'resolves'],
      ['consultation', 'rejects'],
      ['account', 'resolves'],
      ['account', 'rejects'],
    ] as const)('isolates the new %s context when the previous copy %s', async (context, outcome) => {
      const user = userEvent.setup();
      let resolveCopy: () => void;
      let rejectCopy: (error: Error) => void;
      const pendingCopy = new Promise<void>((resolve, reject) => {
        resolveCopy = resolve;
        rejectCopy = reject;
      });
      const copy = vi.spyOn(navigator.clipboard, 'writeText').mockReturnValue(pendingCopy);
      const writeStorage = vi.spyOn(Storage.prototype, 'setItem');
      const props = {
        openOrderForm: mockOpenOrderForm,
        closeWorkspace: mockCloseWorkspace,
        patient: mockFhirPatient,
        visit: { uuid: 'synthetic-visit-a' } as Visit,
        searchTerm: '',
        onSearchTermChange: mockOnSearchTermChange,
      };
      const { rerender } = render(<DrugSearch {...props} />);
      await user.click(screen.getByRole('button', { name: 'Cannot find a medication or supply?' }));
      await user.type(screen.getByRole('textbox', { name: 'Item to request' }), 'Synthetic prior catalog draft');
      await user.click(screen.getByRole('button', { name: 'Copy draft for Pharmacy' }));

      expect(copy).toHaveBeenCalledExactlyOnceWith(
        'Catalog review request — NOT a prescription\n\nSynthetic prior catalog draft',
      );
      expect(screen.getByRole('button', { name: 'Copy draft for Pharmacy' })).toBeDisabled();
      expect(screen.getByRole('textbox', { name: 'Item to request' })).toHaveAttribute('readonly');

      if (context === 'patient') props.patient = { ...mockFhirPatient, id: 'synthetic-patient-b' };
      if (context === 'consultation') props.visit = { uuid: 'synthetic-visit-b' } as Visit;
      if (context === 'account') {
        mockUseSession.mockReturnValue({
          ...mockUseSession(),
          user: { ...mockUseSession()?.user, uuid: 'synthetic-user-b' },
        });
      }
      rerender(<DrugSearch {...props} />);
      await user.click(screen.getByRole('button', { name: 'Cannot find a medication or supply?' }));
      const newInput = screen.getByRole('textbox', { name: 'Item to request' });
      expect(newInput).toHaveValue('');
      expect(newInput).not.toHaveAttribute('readonly');
      expect(screen.queryByRole('textbox', { name: 'Draft for review (not sent)' })).not.toBeInTheDocument();
      await user.type(newInput, 'Synthetic current catalog draft');

      // The prior explicit clipboard call is not cancelled; only the new UI state must remain isolated.
      await act(async () => {
        if (outcome === 'resolves') resolveCopy();
        else rejectCopy(new Error('Synthetic private clipboard detail from prior context'));
      });

      expect(newInput).toHaveValue('Synthetic current catalog draft');
      expect(screen.getByRole('textbox', { name: 'Draft for review (not sent)' })).toHaveValue(
        'Catalog review request — NOT a prescription\n\nSynthetic current catalog draft',
      );
      expect(screen.queryByDisplayValue(/Synthetic prior catalog draft/)).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      expect(screen.getByRole('button', { name: 'Copy draft for Pharmacy' })).toBeEnabled();
      expect(screen.queryByText(/Synthetic private clipboard detail/)).not.toBeInTheDocument();
      expect(copy).toHaveBeenCalledTimes(1);
      expect(openmrsFetch).not.toHaveBeenCalled();
      expect(writeStorage).not.toHaveBeenCalled();
      expect(mockOpenOrderForm).not.toHaveBeenCalled();
      expect(mockCloseWorkspace).not.toHaveBeenCalled();
      expect(mockOnSearchTermChange).not.toHaveBeenCalled();
    });
  });
});
