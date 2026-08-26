import { ExtensionSlot, useLayoutType } from '@openmrs/esm-react-utils';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionMenu } from './action-menu2.component';

vi.mock('@openmrs/esm-react-utils', async () => ({
  ...(await vi.importActual('@openmrs/esm-react-utils')),
  ExtensionSlot: vi.fn(),
  useLayoutType: vi.fn(),
}));

const mockExtensionSlot = vi.mocked(ExtensionSlot);
const mockUseLayoutType = vi.mocked(useLayoutType);
const workspaceGroup = {
  moduleName: '@sihsalus/test-app',
  name: 'test-workspace-group',
} as Parameters<typeof ActionMenu>[0]['workspaceGroup'];

describe('ActionMenu', () => {
  beforeEach(() => {
    mockExtensionSlot.mockReset();
    mockUseLayoutType.mockReturnValue('small-desktop');
  });

  it('reports the rail as hidden when its extensions render no controls', async () => {
    const onVisibilityChange = vi.fn();
    mockExtensionSlot.mockReturnValue(null);

    render(<ActionMenu groupProps={null} onVisibilityChange={onVisibilityChange} workspaceGroup={workspaceGroup} />);

    await waitFor(() => expect(onVisibilityChange).toHaveBeenCalledWith(false));
  });

  it('reports the rail as hidden when every rendered control is visually hidden', async () => {
    const onVisibilityChange = vi.fn();
    mockExtensionSlot.mockReturnValue(
      <div style={{ display: 'none' }}>
        <button type="button">Hidden action</button>
      </div>,
    );

    render(<ActionMenu groupProps={null} onVisibilityChange={onVisibilityChange} workspaceGroup={workspaceGroup} />);

    await waitFor(() => expect(onVisibilityChange).toHaveBeenCalledWith(false));
  });

  it('reports the rail as visible when an extension renders a control', async () => {
    const onVisibilityChange = vi.fn();
    mockExtensionSlot.mockReturnValue(<button type="button">Action</button>);

    render(<ActionMenu groupProps={null} onVisibilityChange={onVisibilityChange} workspaceGroup={workspaceGroup} />);

    await waitFor(() => expect(onVisibilityChange).toHaveBeenCalledWith(true));
  });
});
