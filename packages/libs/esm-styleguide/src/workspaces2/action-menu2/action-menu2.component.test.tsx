import { ExtensionSlot, useLayoutType } from '@openmrs/esm-react-utils';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it('reserves the rendered mobile rail height and updates it when labels resize', async () => {
    mockUseLayoutType.mockReturnValue('phone');
    mockExtensionSlot.mockReturnValue(<button type="button">Lista de tareas</button>);
    let height = 118;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ height }) as DOMRect);
    let notifyResize: () => void;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn().mockImplementation(function (callback: () => void) {
        notifyResize = callback;
        return { observe, disconnect };
      }),
    );
    const onHeightChange = vi.fn();
    const props = { groupProps: null, onHeightChange, workspaceGroup };
    const { container, rerender, unmount } = render(<ActionMenu {...props} />);

    await waitFor(() => expect(onHeightChange).toHaveBeenLastCalledWith(118));
    expect(observe).toHaveBeenCalledWith(container.querySelector('.sideRail'), {
      box: 'border-box',
    });
    height = 86.5;
    act(() => notifyResize());
    expect(onHeightChange).toHaveBeenLastCalledWith(86.5);

    mockUseLayoutType.mockReturnValue('small-desktop');
    rerender(<ActionMenu {...props} />);
    expect(onHeightChange).toHaveBeenLastCalledWith(0);
    expect(disconnect).toHaveBeenCalledOnce();
    mockUseLayoutType.mockReturnValue('phone');
    rerender(<ActionMenu {...props} />);
    expect(onHeightChange).toHaveBeenLastCalledWith(86.5);
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(2);
    expect(onHeightChange).toHaveBeenLastCalledWith(0);
  });

  it('releases mobile space and its observer when extension controls become hidden', async () => {
    mockUseLayoutType.mockReturnValue('phone');
    mockExtensionSlot.mockReturnValue(<button type="button">Action</button>);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: 118,
    } as DOMRect);
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn().mockImplementation(function () {
        return { observe: vi.fn(), disconnect };
      }),
    );
    const onHeightChange = vi.fn();
    const { getByRole, unmount } = render(
      <ActionMenu groupProps={null} onHeightChange={onHeightChange} workspaceGroup={workspaceGroup} />,
    );
    await waitFor(() => expect(onHeightChange).toHaveBeenLastCalledWith(118));
    getByRole('button').hidden = true;
    await waitFor(() => expect(onHeightChange).toHaveBeenLastCalledWith(0));
    expect(disconnect).toHaveBeenCalledOnce();
    unmount();
  });
});
