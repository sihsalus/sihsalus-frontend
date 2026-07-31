import { render, screen } from '@testing-library/react';
import PatientBanner from './PatientBanner';

describe('PatientBanner', () => {
  it('renders placeholder information when no data is present', () => {
    const { container } = render(<PatientBanner />);

    // With no patient the banner is entirely skeletons: that is the placeholder
    // state the name refers to, and the thing worth pinning down.
    expect(container.querySelector('.cds--skeleton__placeholder')).toBeInTheDocument();
    expect(container.querySelectorAll('.cds--skeleton__text').length).toBeGreaterThan(0);
    expect(screen.queryByText(/undefined|null|NaN/)).not.toBeInTheDocument();
  });
});
