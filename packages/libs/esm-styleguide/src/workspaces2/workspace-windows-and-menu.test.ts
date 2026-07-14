import { describe, expect, it } from 'vitest';
import { type WorkspaceStoreState2 } from '@openmrs/esm-extensions';
import { canDisplayOpenedWorkspaceWindow, canDisplayWorkspaceWindow } from './workspace-windows-and-menu.component';

const regularUser = {
  privileges: [{ display: 'allowed-privilege' }],
  roles: [],
} as Parameters<typeof canDisplayWorkspaceWindow>[1];

describe('canDisplayWorkspaceWindow', () => {
  it('displays unrestricted windows', () => {
    expect(canDisplayWorkspaceWindow(undefined, regularUser)).toBe(true);
    expect(canDisplayWorkspaceWindow('', undefined)).toBe(true);
    expect(canDisplayWorkspaceWindow([], undefined)).toBe(true);
  });

  it('displays windows when the user has the required privilege', () => {
    expect(canDisplayWorkspaceWindow('allowed-privilege', regularUser)).toBe(true);
  });

  it('hides windows when the user lacks the required privilege', () => {
    expect(canDisplayWorkspaceWindow('denied-privilege', regularUser)).toBe(false);
    expect(canDisplayWorkspaceWindow('allowed-privilege', undefined)).toBe(false);
  });
});

describe('canDisplayOpenedWorkspaceWindow', () => {
  const openedWindow = {
    windowName: 'clinical-window',
    openedWorkspaces: [
      {
        workspaceName: 'clinical-workspace',
        props: null,
        hasUnsavedChanges: false,
        uuid: 'opened-clinical-workspace',
      },
    ],
    props: null,
    maximized: false,
  };
  const state = {
    registeredGroupsByName: {},
    registeredWindowsByName: {
      'clinical-window': {
        moduleName: '@test/clinical',
        group: 'clinical-group',
        privileges: 'allowed-privilege',
      },
    },
    registeredWorkspacesByName: {
      'clinical-workspace': {
        moduleName: '@test/clinical',
        component: 'clinicalComponent',
        window: 'clinical-window',
        privileges: 'allowed-privilege',
      },
    },
    openedGroup: null,
    openedWindows: [openedWindow],
    isMostRecentlyOpenedWindowHidden: false,
    workspaceTitleByWorkspaceName: {},
  } as WorkspaceStoreState2;

  it('stops displaying an already-open clinical workspace after privilege revocation', () => {
    expect(canDisplayOpenedWorkspaceWindow(state, openedWindow, regularUser)).toBe(true);
    expect(canDisplayOpenedWorkspaceWindow(state, openedWindow, { privileges: [], roles: [] })).toBe(false);
    expect(canDisplayOpenedWorkspaceWindow(state, openedWindow, undefined)).toBe(false);
  });
});
