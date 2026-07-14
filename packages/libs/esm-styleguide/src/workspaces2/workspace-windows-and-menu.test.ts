import { describe, expect, it } from 'vitest';
import { canDisplayWorkspaceWindow } from './workspace-windows-and-menu.component';

const regularUser = {
  privileges: [{ display: 'allowed-privilege' }],
  roles: [],
} as Parameters<typeof canDisplayWorkspaceWindow>[1];

describe('canDisplayWorkspaceWindow', () => {
  it('displays unrestricted windows', () => {
    expect(canDisplayWorkspaceWindow(undefined, regularUser)).toBe(true);
  });

  it('displays windows when the user has the required privilege', () => {
    expect(canDisplayWorkspaceWindow('allowed-privilege', regularUser)).toBe(true);
  });

  it('hides windows when the user lacks the required privilege', () => {
    expect(canDisplayWorkspaceWindow('denied-privilege', regularUser)).toBe(false);
    expect(canDisplayWorkspaceWindow('allowed-privilege', undefined)).toBe(false);
  });
});
