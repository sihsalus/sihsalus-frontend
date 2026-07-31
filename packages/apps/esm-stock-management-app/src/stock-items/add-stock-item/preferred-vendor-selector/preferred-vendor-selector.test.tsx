import { render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';

import { useStockSources } from '../../../stock-sources/stock-sources.resource';

import PreferredVendorSelector from './preferred-vendor-selector.component';

vi.mock('../../../stock-sources/stock-sources.resource', () => ({
  useStockSources: vi.fn(),
}));

const mockUseStockSources = vi.mocked(useStockSources);

function Harness() {
  const { control } = useForm();
  return (
    <PreferredVendorSelector
      control={control}
      controllerName="preferredVendorUuid"
      name="preferredVendorUuid"
      title="Preferred vendor"
      placeholder="Choose a vendor"
    />
  );
}

describe('Test the preferred vendor selector', () => {
  it('renders a skeleton while the vendor list is loading', () => {
    mockUseStockSources.mockReturnValue({
      items: { results: [] },
      isLoading: true,
    } as ReturnType<typeof useStockSources>);

    const { container } = render(<Harness />);

    expect(container.querySelector('.cds--skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('offers the loaded vendors once they arrive', () => {
    mockUseStockSources.mockReturnValue({
      items: { results: [{ uuid: 'vendor-1', name: 'Almacén Central' }] },
      isLoading: false,
    } as ReturnType<typeof useStockSources>);

    render(<Harness />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
