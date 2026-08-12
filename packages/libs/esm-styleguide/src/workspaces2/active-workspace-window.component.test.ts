import { type OpenedWindow, type OpenedWorkspace } from '@openmrs/esm-extensions';
import { describe, expect, it, vi } from 'vitest';
import { createChildWorkspaceLauncher } from './active-workspace-window.component';

function openedWorkspace(workspaceName: string, hasUnsavedChanges = false): OpenedWorkspace {
  return {
    workspaceName,
    props: {},
    hasUnsavedChanges,
    uuid: `uuid-${workspaceName}`,
  };
}

function openedWindow(workspaces: Array<OpenedWorkspace>): OpenedWindow {
  return {
    windowName: 'test-window',
    openedWorkspaces: workspaces,
    props: {},
    maximized: false,
  };
}

describe('createChildWorkspaceLauncher', () => {
  it('returns false without opening a child when access is denied', async () => {
    const parent = openedWorkspace('parent-workspace');
    const openChildWorkspace = vi.fn();
    const canLaunchWorkspace = vi.fn(() => false);
    const promptForClosing = vi.fn();
    const warn = vi.fn();
    const launchChildWorkspace = createChildWorkspaceLauncher({
      openedWorkspace: parent,
      openedWindow: openedWindow([parent]),
      openChildWorkspace,
      getWorkspace: () => ({ privileges: ['app:protected'] }),
      canLaunchWorkspace,
      promptForClosing,
      warn,
    });

    await expect(launchChildWorkspace('child-workspace', { source: 'test' })).resolves.toBe(false);

    expect(canLaunchWorkspace).toHaveBeenCalledWith(['app:protected']);
    expect(promptForClosing).not.toHaveBeenCalled();
    expect(openChildWorkspace).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('Access denied while launching workspace "child-workspace".');
  });

  it('returns false without replacing a dirty child when the user cancels', async () => {
    const parent = openedWorkspace('parent-workspace');
    const dirtyChild = openedWorkspace('dirty-child-workspace', true);
    const currentOpenedWindow = openedWindow([parent, dirtyChild]);
    const openChildWorkspace = vi.fn();
    const promptForClosing = vi.fn().mockResolvedValue(false);
    const launchChildWorkspace = createChildWorkspaceLauncher({
      openedWorkspace: parent,
      openedWindow: currentOpenedWindow,
      openChildWorkspace,
      getOpenedWindow: () => currentOpenedWindow,
      getWorkspace: () => ({ privileges: [] }),
      canLaunchWorkspace: () => true,
      promptForClosing,
    });

    await expect(launchChildWorkspace('replacement-workspace')).resolves.toBe(false);

    expect(promptForClosing).toHaveBeenCalledWith({
      reason: 'CLOSE_WORKSPACE',
      explicit: true,
      windowName: 'test-window',
      workspaceName: 'dirty-child-workspace',
    });
    expect(openChildWorkspace).not.toHaveBeenCalled();
  });

  it('returns false when the parent closes while confirming replacement of a dirty child', async () => {
    const parent = openedWorkspace('parent-workspace');
    const dirtyChild = openedWorkspace('dirty-child-workspace', true);
    let currentOpenedWindow: OpenedWindow | undefined = openedWindow([parent, dirtyChild]);
    const openChildWorkspace = vi.fn();
    const promptForClosing = vi.fn().mockImplementation(async () => {
      currentOpenedWindow = undefined;
      return true;
    });
    const launchChildWorkspace = createChildWorkspaceLauncher({
      openedWorkspace: parent,
      openedWindow: currentOpenedWindow,
      openChildWorkspace,
      getOpenedWindow: () => currentOpenedWindow,
      getWorkspace: () => ({ privileges: [] }),
      canLaunchWorkspace: () => true,
      promptForClosing,
    });

    await expect(launchChildWorkspace('replacement-workspace')).resolves.toBe(false);

    expect(promptForClosing).toHaveBeenCalledOnce();
    expect(openChildWorkspace).not.toHaveBeenCalled();
  });

  it('returns false when a new dirty child appears while confirming replacement', async () => {
    const parent = openedWorkspace('parent-workspace');
    const dirtyChild = openedWorkspace('dirty-child-workspace', true);
    let currentOpenedWindow = openedWindow([parent, dirtyChild]);
    const openChildWorkspace = vi.fn();
    const promptForClosing = vi.fn().mockImplementation(async () => {
      currentOpenedWindow = openedWindow([parent, dirtyChild, openedWorkspace('new-dirty-child', true)]);
      return true;
    });
    const launchChildWorkspace = createChildWorkspaceLauncher({
      openedWorkspace: parent,
      openedWindow: currentOpenedWindow,
      openChildWorkspace,
      getOpenedWindow: () => currentOpenedWindow,
      getWorkspace: () => ({ privileges: [] }),
      canLaunchWorkspace: () => true,
      promptForClosing,
    });

    await expect(launchChildWorkspace('replacement-workspace')).resolves.toBe(false);

    expect(promptForClosing).toHaveBeenCalledOnce();
    expect(openChildWorkspace).not.toHaveBeenCalled();
  });

  it('returns false when an existing clean child becomes dirty while confirming replacement', async () => {
    const parent = openedWorkspace('parent-workspace');
    const dirtyChild = openedWorkspace('dirty-child-workspace', true);
    const cleanChild = openedWorkspace('clean-child-workspace');
    let currentOpenedWindow = openedWindow([parent, dirtyChild, cleanChild]);
    const openChildWorkspace = vi.fn();
    const promptForClosing = vi.fn().mockImplementation(async () => {
      currentOpenedWindow = openedWindow([parent, dirtyChild, { ...cleanChild, hasUnsavedChanges: true }]);
      return true;
    });
    const launchChildWorkspace = createChildWorkspaceLauncher({
      openedWorkspace: parent,
      openedWindow: currentOpenedWindow,
      openChildWorkspace,
      getOpenedWindow: () => currentOpenedWindow,
      getWorkspace: () => ({ privileges: [] }),
      canLaunchWorkspace: () => true,
      promptForClosing,
    });

    await expect(launchChildWorkspace('replacement-workspace')).resolves.toBe(false);

    expect(promptForClosing).toHaveBeenCalledOnce();
    expect(openChildWorkspace).not.toHaveBeenCalled();
  });

  it('returns true after opening the child workspace', async () => {
    const parent = openedWorkspace('parent-workspace');
    const currentOpenedWindow = openedWindow([parent]);
    const openChildWorkspace = vi.fn();
    const launchChildWorkspace = createChildWorkspaceLauncher({
      openedWorkspace: parent,
      openedWindow: currentOpenedWindow,
      openChildWorkspace,
      getOpenedWindow: () => currentOpenedWindow,
      getWorkspace: () => ({ privileges: [] }),
      canLaunchWorkspace: () => true,
    });

    await expect(launchChildWorkspace('child-workspace', { source: 'test' })).resolves.toBe(true);

    expect(openChildWorkspace).toHaveBeenCalledWith('parent-workspace', 'child-workspace', { source: 'test' });
  });
});
