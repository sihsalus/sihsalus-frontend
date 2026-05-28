import { getPatientName } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PatientBanner from './patient-banner.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  getPatientName: vi.fn(),
  PatientBannerActionsMenu: () => <div>actions</div>,
  PatientBannerPatientInfo: () => <div>patient-info</div>,
  PatientBannerToggleContactDetailsButton: ({ showContactDetails, toggleContactDetails }) => (
    <button type="button" onClick={toggleContactDetails}>
      {showContactDetails ? 'toggle-less' : 'toggle-details'}
    </button>
  ),
  PatientPhoto: () => <div>patient-photo</div>,
}));

vi.mock('./patient-banner-contact-details.component', () => ({
  PatientBannerContactDetails: () => <div>contact-details</div>,
}));

const mockPatient = {
  id: 'patient-123',
  resourceType: 'Patient',
  gender: 'male',
  birthDate: '1998-05-07',
} as fhir.Patient;

let resizeObserverWidth = 1024;

class MockResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}

  observe() {
    this.callback(
      [
        {
          contentRect: { width: resizeObserverWidth },
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }

  unobserve() {}
}

describe('PatientBanner', () => {
  beforeEach(() => {
    resizeObserverWidth = 1024;
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.mocked(getPatientName).mockReturnValue('Prueba Laboratorio Masculino');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders nothing when the patient is missing', () => {
    const { container } = render(<PatientBanner patient={undefined} patientUuid="patient-123" />);

    expect(container).toBeEmptyDOMElement();
    expect(getPatientName).not.toHaveBeenCalled();
  });

  it('keeps the patient banner visible when contact details are expanded', async () => {
    const user = userEvent.setup();

    render(<PatientBanner patient={mockPatient} patientUuid="patient-123" />);

    await user.click(screen.getByRole('button', { name: 'toggle-details' }));

    expect(screen.getByText('patient-photo')).toBeInTheDocument();
    expect(screen.getByText('patient-info')).toBeInTheDocument();
    expect(screen.getByText('actions')).toBeInTheDocument();
    expect(screen.getByText('contact-details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'toggle-less' })).toBeInTheDocument();
  });

  it('uses the observed banner width instead of scroll width to place the details toggle', async () => {
    resizeObserverWidth = 480;
    const scrollWidthSpy = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1200);
    const { container } = render(<PatientBanner patient={mockPatient} patientUuid="patient-123" />);

    await waitFor(() => {
      const toggleButton = screen.getByRole('button', { name: 'toggle-details' });
      expect(toggleButton.parentElement).toBe(container.querySelector('header'));
    });

    scrollWidthSpy.mockRestore();
  });

  it('starts observing the banner when the patient loads after the initial render', async () => {
    resizeObserverWidth = 480;
    const { container, rerender } = render(<PatientBanner patient={undefined} patientUuid="patient-123" />);

    expect(container).toBeEmptyDOMElement();

    rerender(<PatientBanner patient={mockPatient} patientUuid="patient-123" />);

    await waitFor(() => {
      const toggleButton = screen.getByRole('button', { name: 'toggle-details' });
      expect(toggleButton.parentElement).toBe(container.querySelector('header'));
    });
  });
});
