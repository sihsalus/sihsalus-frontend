import { render, screen } from '@testing-library/react';
import { mockDeceasedPatient, mockPatient } from 'test-utils';
import DeceasedPatientBannerTag from './deceased-patient-tag.extension';

describe('DeceasedPatientTag', () => {
  it('does not render Deceased tag for patients who are still alive', () => {
    const patient = { ...mockPatient, deceasedDateTime: '' } as unknown as fhir.Patient;
    render(<DeceasedPatientBannerTag patient={patient} />);
    expect(screen.queryByRole('tooltip', { name: / 04-Apr-1972, 12:00\s+AM/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deceased/ })).not.toBeInTheDocument();
  });

  it('renders a deceased tag in the patient banner for patients who died', () => {
    render(<DeceasedPatientBannerTag patient={mockDeceasedPatient as unknown as fhir.Patient} />);

    expect(screen.getByRole('tooltip', { name: / 04-Apr-1972, 12:00\s+AM/i }));
    expect(screen.getByRole('button', { name: /Deceased/ })).toBeInTheDocument();
  });
});
