import { openmrsFetch, useSession } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

import { clinicalFormsEditPrivilege, clinicalFormsViewPrivilege } from '../constants';
import type { Form } from '../types';
import { useFormAccess } from './use-form-access';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseSession = vi.mocked(useSession);

const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

function makeForm(editPrivilege?: string): Form {
  return {
    uuid: 'form-uuid',
    name: 'Clinical form',
    display: 'Clinical form',
    version: '1',
    published: true,
    retired: false,
    resources: [],
    encounterType: {
      uuid: 'encounter-type-uuid',
      name: 'Clinical encounter',
      viewPrivilege: null,
      editPrivilege: editPrivilege
        ? { uuid: 'edit-privilege-uuid', name: editPrivilege, display: editPrivilege }
        : null,
    },
  };
}

describe('useFormAccess', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: { uuid: 'user-uuid', privileges: [], roles: [] },
    } as ReturnType<typeof useSession>);
  });

  it('resolves legacy form UUIDs before authorizing the workspace', async () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: {
        uuid: 'user-uuid',
        privileges: [{ uuid: 'edit-uuid', name: 'Edit Form', display: 'Edit Form' }],
        roles: [],
      },
    } as ReturnType<typeof useSession>);
    mockOpenmrsFetch.mockResolvedValue({ data: makeForm('Edit Form') } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useFormAccess('form-uuid'), { wrapper });

    await waitFor(() => expect(result.current.form?.uuid).toBe('form-uuid'));
    expect(result.current.canEdit).toBe(true);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining('/form/form-uuid?v=custom:'));
  });

  it('requires the explicit clinical-forms edit privilege when encounter metadata is absent', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: {
        uuid: 'user-uuid',
        privileges: [
          { uuid: 'generic-edit-uuid', name: clinicalFormsEditPrivilege, display: clinicalFormsEditPrivilege },
        ],
        roles: [],
      },
    } as ReturnType<typeof useSession>);

    const { result } = renderHook(() => useFormAccess('form-uuid', makeForm()), { wrapper });

    expect(result.current.canEdit).toBe(true);
  });

  it('requires the explicit clinical-forms view privilege when view metadata is absent', () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: {
        uuid: 'user-uuid',
        privileges: [
          { uuid: 'generic-view-uuid', name: clinicalFormsViewPrivilege, display: clinicalFormsViewPrivilege },
        ],
        roles: [],
      },
    } as ReturnType<typeof useSession>);

    const { result } = renderHook(() => useFormAccess('form-uuid', makeForm()), { wrapper });

    expect(result.current.canView).toBe(true);
  });

  it('fails closed when the form cannot be resolved', () => {
    const { result } = renderHook(() => useFormAccess(undefined), { wrapper });

    expect(result.current.form).toBeUndefined();
    expect(result.current.canEdit).toBe(false);
    expect(result.current.canView).toBe(false);
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});
