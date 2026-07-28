import { render } from '@testing-library/react';
import PatientBanner from './patient-banner';

describe('PatientBanner', () => {
  it('renders placeholder information when no data is present', () => {
    render(<PatientBanner />);
  });
});
