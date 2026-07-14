import { getWorkspaceRegistration } from '@openmrs/esm-extensions';
import { describe, expect, it } from 'vitest';
import { tryRegisterWorkspace } from './components';

describe('tryRegisterWorkspace', () => {
  it('preserves the workspace privilege requirements from routes.json', () => {
    const privileges = ['view-clinical-data', 'edit-clinical-data'];

    tryRegisterWorkspace('@openmrs/test-app', {
      name: 'protected-routes-workspace',
      title: 'Protected workspace',
      component: 'protectedWorkspace',
      type: 'form',
      groups: [],
      privileges,
    });

    expect(getWorkspaceRegistration('protected-routes-workspace').privileges).toEqual(privileges);
  });
});
