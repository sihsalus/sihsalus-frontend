import { useAssignedExtensions, useOnClickOutside } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AppMenuButton from './app-menu-button.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useAssignedExtensions: vi.fn(),
  useOnClickOutside: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const mockUseAssignedExtensions = vi.mocked(useAssignedExtensions);
const mockUseOnClickOutside = vi.mocked(useOnClickOutside);

const defaultProps = {
  hidePanel: vi.fn(() => vi.fn()),
  isActivePanel: vi.fn(() => false),
  togglePanel: vi.fn(),
};

describe('AppMenuButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOnClickOutside.mockReturnValue({ current: null });
  });

  it('is hidden when the user has no authorized modules', () => {
    mockUseAssignedExtensions.mockReturnValue([]);

    render(<AppMenuButton {...defaultProps} />);

    expect(screen.queryByLabelText('App Menu')).not.toBeInTheDocument();
  });

  it('is visible when at least one authorized module is assigned', () => {
    mockUseAssignedExtensions.mockReturnValue([{ id: 'home-app-menu-item' }] as never);

    render(<AppMenuButton {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('App Menu'));

    expect(defaultProps.togglePanel).toHaveBeenCalledWith('appMenu');
    expect(mockUseAssignedExtensions).toHaveBeenCalledWith('app-menu-item-slot');
  });
});
