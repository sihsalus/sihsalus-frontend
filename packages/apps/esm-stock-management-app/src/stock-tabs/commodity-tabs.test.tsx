import { render, screen, within } from '@testing-library/react';
import StockCommodityTabs from './commodity-tabs.component';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) =>
      ({
        stockItems: 'Artículos de inventario',
        stockOperations: 'Operaciones de inventario',
        userRoleScopes: 'Ámbitos de rol de usuario',
        sources: 'Fuentes',
      })[key] ?? fallback,
  }),
}));

vi.mock('../stock-items/stock-items.component', () => ({ default: () => <div>stock items panel</div> }));
vi.mock('../stock-operations/stock-operations-table.component', () => ({
  default: () => <div>stock operations panel</div>,
}));
vi.mock('../stock-sources/stock-sources.component', () => ({ default: () => <div>stock sources panel</div> }));
vi.mock('../stock-user-role-scopes/stock-user-role-scopes.component', () => ({
  default: () => <div>user role scopes panel</div>,
}));

describe('StockCommodityTabs', () => {
  it('renders localized tab labels', () => {
    render(<StockCommodityTabs />);

    const tabList = screen.getByRole('tablist');

    expect(within(tabList).getByRole('tab', { name: 'Artículos de inventario' })).toBeInTheDocument();
    expect(within(tabList).getByRole('tab', { name: 'Operaciones de inventario' })).toBeInTheDocument();
    expect(within(tabList).getByRole('tab', { name: 'Ámbitos de rol de usuario' })).toBeInTheDocument();
    expect(within(tabList).getByRole('tab', { name: 'Fuentes' })).toBeInTheDocument();
    expect(within(tabList).queryByRole('tab', { name: 'Items' })).not.toBeInTheDocument();
    expect(within(tabList).queryByRole('tab', { name: 'Operations' })).not.toBeInTheDocument();
    expect(within(tabList).queryByRole('tab', { name: 'User Roles' })).not.toBeInTheDocument();
  });
});
