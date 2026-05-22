import { screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { mockOrderStockData, renderWithSwr } from 'test-utils';

import { useOrderStockInfo } from '../hooks/useOrderStockInfo';

import OrderStockDetailsComponent from './order-stock-details.component';

const mockUseOrderStockInfo = vi.mocked(useOrderStockInfo);

vi.mock('../hooks/useOrderStockInfo', () => ({
  useOrderStockInfo: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(),
}));

const mockUseTranslation = useTranslation as vi.Mock;

describe('OrderStockDetailsComponent', () => {
  const mockOrderItemUuid = 'test-uuid';

  beforeEach(() => {
    vi.resetAllMocks();
    mockUseTranslation.mockImplementation(() => ({
      t: (_key: string, fallback: string) => fallback,
    }));
  });

  it('renders loading skeleton when data is loading', () => {
    mockUseOrderStockInfo.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    const { container } = renderWithSwr(<OrderStockDetailsComponent orderItemUuid={mockOrderItemUuid} />);
    expect(container.querySelector('.cds--skeleton__text')).toBeInTheDocument();
  });

  it('renders nothing when stock data is null', () => {
    mockUseOrderStockInfo.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });

    const { container } = renderWithSwr(<OrderStockDetailsComponent orderItemUuid={mockOrderItemUuid} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders "In Stock" when item is active and has positive quantity', () => {
    mockUseOrderStockInfo.mockReturnValue({
      data: mockOrderStockData,
      isLoading: false,
      error: null,
    });

    renderWithSwr(<OrderStockDetailsComponent orderItemUuid={mockOrderItemUuid} />);

    expect(screen.getByText(/In stock/i)).toBeInTheDocument();
    expect(screen.getByText('CheckmarkFilledIcon')).toBeInTheDocument();
  });

  it('renders "Out of Stock" when item has zero quantity', () => {
    const outOfStockData = {
      ...mockOrderStockData,
      entry: [
        {
          ...mockOrderStockData.entry[0],
          resource: {
            ...mockOrderStockData.entry[0].resource,
            netContent: {
              value: 0,
              unit: 'units',
            },
          },
        },
      ],
    };

    mockUseOrderStockInfo.mockReturnValue({
      data: outOfStockData,
      isLoading: false,
      error: null,
    });

    renderWithSwr(<OrderStockDetailsComponent orderItemUuid={mockOrderItemUuid} />);

    expect(screen.getByText(/Out of stock/i)).toBeInTheDocument();
    expect(screen.getByText('CloseFilledIcon')).toBeInTheDocument();
  });

  it('renders "Out of Stock" when item is inactive', () => {
    const inactiveData = {
      ...mockOrderStockData,
      entry: [
        {
          ...mockOrderStockData.entry[0],
          resource: {
            ...mockOrderStockData.entry[0].resource,
            status: 'inactive',
          },
        },
      ],
    };

    mockUseOrderStockInfo.mockReturnValue({
      data: inactiveData,
      isLoading: false,
      error: null,
    });

    renderWithSwr(<OrderStockDetailsComponent orderItemUuid={mockOrderItemUuid} />);

    expect(screen.getByText(/Out of stock/i)).toBeInTheDocument();
    expect(screen.getByText('CloseFilledIcon')).toBeInTheDocument();
  });

  it('renders "Out of Stock" when entry array is empty', () => {
    const emptyData = {
      ...mockOrderStockData,
      entry: [],
    };

    mockUseOrderStockInfo.mockReturnValue({
      data: emptyData,
      isLoading: false,
      error: null,
    });

    renderWithSwr(<OrderStockDetailsComponent orderItemUuid={mockOrderItemUuid} />);

    expect(screen.getByText(/Out of stock/i)).toBeInTheDocument();
    expect(screen.getByText('CloseFilledIcon')).toBeInTheDocument();
  });
});
