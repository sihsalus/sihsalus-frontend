import { getWorkspaceHeaderCloseOptions } from './workspace2.component';

describe('Workspace2 header close behavior', () => {
  it('closes only the current workspace when it is a child', () => {
    expect(getWorkspaceHeaderCloseOptions(false)).toEqual({ closeWindow: false });
  });

  it('closes the window when it is the root workspace', () => {
    expect(getWorkspaceHeaderCloseOptions(true)).toEqual({ closeWindow: true });
  });
});
