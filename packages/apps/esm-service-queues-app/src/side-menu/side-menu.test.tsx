import { render, screen } from '@testing-library/react';

import SideMenu from './side-menu.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  LeftNavMenu: () => <div data-testid="left-nav-menu">Mocked LeftNavMenu</div>,
}));

describe('SideMenu', () => {
  it('renders the LeftNavMenu', () => {
    render(<SideMenu />);

    const leftNavMenu = screen.getByTestId('left-nav-menu');
    expect(leftNavMenu).toBeInTheDocument();
  });
});
