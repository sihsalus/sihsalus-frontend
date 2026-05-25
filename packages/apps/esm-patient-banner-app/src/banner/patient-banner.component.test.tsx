import { getPatientName } from '@openmrs/esm-framework';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import PatientBanner from './patient-banner.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  getPatientName: vi.fn(),
  PatientBannerActionsMenu: () => <div>actions</div>,
  PatientBannerContactDetails: () => <div>contact-details</div>,
  PatientBannerPatientInfo: () => <div>patient-info</div>,
  PatientBannerToggleContactDetailsButton: ({ showContactDetails, toggleContactDetails }) => (
    <button type="button" onClick={toggleContactDetails}>
      {showContactDetails ? 'hide-details' : 'toggle-details'}
    </button>
  ),
  PatientPhoto: () => <div>patient-photo</div>,
}));

let resizeObserverCallback: ResizeObserverCallback | undefined;

const triggerResize = (width: number) => {
  resizeObserverCallback?.([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
};

describe('PatientBanner', () => {
  beforeEach(() => {
    resizeObserverCallback = undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeObserverCallback = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders nothing when the patient is missing', () => {
    const { container } = render(<PatientBanner patient={undefined} patientUuid="patient-123" />);

    expect(container).toBeEmptyDOMElement();
    expect(getPatientName).not.toHaveBeenCalled();
  });

  it('shows contact details when toggled open', async () => {
    const user = userEvent.setup();

    render(<PatientBanner patient={{ id: 'fhir-id' } as fhir.Patient} patientUuid="patient-123" />);

    act(() => triggerResize(480));

    expect(screen.queryByText('contact-details')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'toggle-details' }));

    expect(screen.getByText('contact-details')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'hide-details' })).toBeInTheDocument();
  });
});
