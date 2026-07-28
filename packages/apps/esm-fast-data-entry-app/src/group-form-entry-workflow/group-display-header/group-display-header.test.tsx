import { render } from '@testing-library/react';
import GroupDisplayHeader from './group-display-header';

describe('PatientBanner', () => {
  it('renders placeholder information when no data is present', () => {
    render(<GroupDisplayHeader />);
  });
});
