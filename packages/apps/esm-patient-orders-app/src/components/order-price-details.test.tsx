import { getLocale } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import { mockOrderPriceData, renderWithSwr } from 'test-utils';

import { useOrderPrice } from '../hooks/useOrderPrice';

import OrderPriceDetailsComponent from './order-price-details.component';

const mockGetLocale = vi.mocked(getLocale);
const mockUseOrderPrice = vi.mocked(useOrderPrice);

vi.mock('../hooks/useOrderPrice', () => ({
  useOrderPrice: vi.fn(),
}));

describe('OrderPriceDetailsComponent', () => {
  const mockOrderItemUuid = 'test-uuid';

  beforeEach(() => {
    vi.resetAllMocks();
    mockGetLocale.mockReturnValue('en-US');
  });

  it('renders loading skeleton when data is loading', () => {
    mockUseOrderPrice.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    const { container } = renderWithSwr(<OrderPriceDetailsComponent orderItemUuid={mockOrderItemUuid} />);
    expect(container.querySelector('.cds--skeleton__text')).toBeInTheDocument();
  });

  it('renders nothing when amount is null', () => {
    mockUseOrderPrice.mockReturnValue({
      data: {
        ...mockOrderPriceData,
        entry: [],
      },
      isLoading: false,
      error: null,
    });

    const { container } = renderWithSwr(<OrderPriceDetailsComponent orderItemUuid={mockOrderItemUuid} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders price correctly with USD currency', () => {
    mockUseOrderPrice.mockReturnValue({
      data: mockOrderPriceData,
      isLoading: false,
      error: null,
    });

    renderWithSwr(<OrderPriceDetailsComponent orderItemUuid={mockOrderItemUuid} />);

    expect(screen.getByText('Price:')).toBeInTheDocument();
    expect(screen.getByText('$99.99')).toBeInTheDocument();
  });

  it('formats price correctly for different locales', () => {
    mockUseOrderPrice.mockReturnValue({
      data: mockOrderPriceData,
      isLoading: false,
      error: null,
    });

    // Change to German locale for this test
    mockGetLocale.mockReturnValue('de-DE');

    renderWithSwr(<OrderPriceDetailsComponent orderItemUuid={mockOrderItemUuid} />);

    expect(screen.getByText('99,99 $')).toBeInTheDocument();
  });

  it('handles invalid currency codes gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockUseOrderPrice.mockReturnValue({
      data: {
        ...mockOrderPriceData,
        entry: [
          {
            resource: {
              ...mockOrderPriceData.entry[0].resource,
              propertyGroup: [
                {
                  priceComponent: [
                    {
                      type: 'base',
                      amount: { value: 99.99, currency: 'INVALID' },
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    renderWithSwr(<OrderPriceDetailsComponent orderItemUuid={mockOrderItemUuid} />);

    expect(screen.getByText('Price:')).toBeInTheDocument();
    expect(screen.getByText('99.99 INVALID')).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid currency code: INVALID'));

    consoleSpy.mockRestore();
  });

  it('displays tooltip with price disclaimer', () => {
    mockUseOrderPrice.mockReturnValue({
      data: mockOrderPriceData,
      isLoading: false,
      error: null,
    });

    renderWithSwr(<OrderPriceDetailsComponent orderItemUuid={mockOrderItemUuid} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByLabelText(/This price is indicative/)).toBeInTheDocument();
  });
});
