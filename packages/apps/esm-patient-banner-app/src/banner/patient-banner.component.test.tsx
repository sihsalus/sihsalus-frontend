import { getPatientName } from '@openmrs/esm-framework';
import { render } from '@testing-library/react';

import PatientBanner from './patient-banner.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  getPatientName: vi.fn(),
  PatientBannerActionsMenu: () => <div>actions</div>,
  PatientBannerContactDetails: () => <div>contact-details</div>,
  PatientBannerPatientInfo: () => <div>patient-info</div>,
  PatientBannerToggleContactDetailsButton: () => <button type="button">toggle-details</button>,
  PatientPhoto: () => <div>patient-photo</div>,
}));

describe('PatientBanner', () => {
  it('renders nothing when the patient is missing', () => {
    const { container } = render(<PatientBanner patient={undefined} patientUuid="patient-123" />);

    expect(container).toBeEmptyDOMElement();
    expect(getPatientName).not.toHaveBeenCalled();
  });
});
