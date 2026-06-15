import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { useDefaultFacility } from '../../billing.resource';
import PrintableFooter from './printable-footer.component';

const mockUseDefaultFacility = vi.mocked<typeof useDefaultFacility>(useDefaultFacility);

vi.mock('../../billing.resource', () => ({
  useDefaultFacility: vi.fn(),
}));

describe('PrintableFooter', () => {
  test('should render PrintableFooter component', () => {
    mockUseDefaultFacility.mockReturnValue({
      data: { display: 'MTRH', uuid: 'mtrh-uuid', links: [] },
    });
    render(<PrintableFooter />);
    const footer = screen.getByText('MTRH');
    expect(footer).toBeInTheDocument();
  });
});
