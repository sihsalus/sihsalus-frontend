import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { type ConfigSchema, type Session, showSnackbar, useConfig, useSession } from '@openmrs/esm-framework';
import FormWorkflowContext from '../../context/FormWorkflowContext';
import { useHsuIdIdentifier } from '../../hooks/location-tag.resource';
import PatientSearchHeader from './PatientSearchHeader';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  ExtensionSlot: ({ state }) => (
    <button type="button" data-testid="mock-search-select" onClick={() => state.selectPatientAction('patient-123')}>
      Select Patient
    </button>
  ),
  interpolateUrl: vi.fn((url) => url),
  navigate: vi.fn(),
  showSnackbar: vi.fn(),
  useConfig: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue: string, interpolation: { hsuLocation?: string; sessionLocation?: string }) => {
      if (interpolation?.hsuLocation) {
        return `Error: Patient at ${interpolation.hsuLocation} cannot be added to session at ${interpolation.sessionLocation}`;
      }
      return defaultValue || key;
    },
  }),
}));

vi.mock('../../hooks/location-tag.resource', () => ({
  useHsuIdIdentifier: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children }) => <div>{children}</div>,
}));

const mockShowSnackbar = showSnackbar as vi.MockedFunction<typeof showSnackbar>;
const mockUseConfig = useConfig as vi.MockedFunction<typeof useConfig>;
const mockUseSession = useSession as vi.MockedFunction<typeof useSession>;
const mockUseHsuIdIdentifier = useHsuIdIdentifier as vi.MockedFunction<typeof useHsuIdIdentifier>;

describe('PatientSearchHeader - Enforcement Feature', () => {
  const mockContext = {
    addPatient: vi.fn(),
    workflowState: 'NEW_PATIENT',
    activeFormUuid: 'form-123',
  };

  const sessionLocation = { uuid: 'loc-session', display: 'General Hospital' };
  const mismatchedHsuLocation = {
    location: { uuid: 'loc-other', display: 'Remote Clinic' },
  };

  beforeEach(() => {
    mockUseSession.mockReturnValue({ sessionLocation } as Session);
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('triggers an error Snackbar when enforcePatientListLocationMatch is enabled and locations mismatch', async () => {
    mockUseConfig.mockReturnValue({
      enforcePatientListLocationMatch: true,
      patientLocationMismatchCheck: false,
    } as ConfigSchema);

    mockUseHsuIdIdentifier.mockReturnValue({
      hsuIdentifier: mismatchedHsuLocation,
    } as unknown as ReturnType<typeof useHsuIdIdentifier>);

    render(
      <FormWorkflowContext.Provider value={mockContext as never}>
        <PatientSearchHeader />
      </FormWorkflowContext.Provider>,
    );

    const searchBar = screen.getByTestId('mock-search-select');
    fireEvent.click(searchBar);

    await waitFor(() => {
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          title: 'Location Mismatch',
          subtitle: expect.stringContaining('Remote Clinic'),
        }),
      );
    });

    expect(mockContext.addPatient).not.toHaveBeenCalled();
  });

  it('does NOT trigger snackbar and adds patient if locations match even if enforcement is on', async () => {
    mockUseConfig.mockReturnValue({
      enforcePatientListLocationMatch: true,
    } as ConfigSchema);

    mockUseHsuIdIdentifier.mockReturnValue({
      hsuIdentifier: { location: { uuid: 'loc-session', display: 'General Hospital' } },
    } as unknown as ReturnType<typeof useHsuIdIdentifier>);

    render(
      <FormWorkflowContext.Provider value={mockContext as never}>
        <PatientSearchHeader />
      </FormWorkflowContext.Provider>,
    );

    fireEvent.click(screen.getByTestId('mock-search-select'));

    await waitFor(() => {
      expect(mockContext.addPatient).toHaveBeenCalledWith('patient-123');
      expect(mockShowSnackbar).not.toHaveBeenCalled();
    });
  });
});
