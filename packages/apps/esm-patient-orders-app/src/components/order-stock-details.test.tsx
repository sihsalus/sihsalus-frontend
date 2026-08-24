import { screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { renderWithSwr } from 'test-utils';

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
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseTranslation.mockImplementation(() => ({
      t: (_key: string, fallback: string) => fallback,
    }));
  });

  it('renders a loading skeleton', () => {
    mockUseOrderStockInfo.mockReturnValue({ status: null, isLoading: true, error: undefined });

    const { container } = renderWithSwr(<OrderStockDetailsComponent orderItemUuid="drug-uuid" />);

    expect(container.querySelector('.cds--skeleton__text')).toBeInTheDocument();
  });

  it.each([null, 'untracked'] as const)('renders nothing for status %s', (status) => {
    mockUseOrderStockInfo.mockReturnValue({ status, isLoading: false, error: undefined });

    const { container } = renderWithSwr(<OrderStockDetailsComponent orderItemUuid="drug-uuid" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders in-stock for a positive balance', () => {
    mockUseOrderStockInfo.mockReturnValue({ status: 'in-stock', isLoading: false, error: undefined });

    renderWithSwr(<OrderStockDetailsComponent orderItemUuid="drug-uuid" />);

    expect(screen.getByText(/In stock/i)).toBeInTheDocument();
    expect(screen.getByText('CheckmarkFilledIcon')).toBeInTheDocument();
  });

  it('renders out-of-stock only for a tracked zero balance', () => {
    mockUseOrderStockInfo.mockReturnValue({ status: 'out-of-stock', isLoading: false, error: undefined });

    renderWithSwr(<OrderStockDetailsComponent orderItemUuid="drug-uuid" />);

    expect(screen.getByText(/Out of stock/i)).toBeInTheDocument();
    expect(screen.getByText('CloseFilledIcon')).toBeInTheDocument();
  });

  it('hides availability when the request fails', () => {
    mockUseOrderStockInfo.mockReturnValue({
      status: null,
      isLoading: false,
      error: new Error('Stock unavailable'),
    });

    const { container } = renderWithSwr(<OrderStockDetailsComponent orderItemUuid="drug-uuid" />);

    expect(container).toBeEmptyDOMElement();
  });
});
