import { openmrsFetch, useSession } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

import useGetAllForms from './useGetAllForms';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseSession = vi.mocked(useSession);

const form = (uuid: string, editPrivilege?: string) => ({
  uuid,
  name: uuid,
  display: uuid,
  published: true,
  encounterType: {
    editPrivilege: editPrivilege ? { display: editPrivilege } : null,
  },
});

const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

describe('useGetAllForms privilege filtering', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: {
        uuid: 'user-uuid',
        privileges: [{ uuid: 'edit-form', name: 'Edit Form', display: 'Edit Form' }],
        roles: [],
      },
    } as ReturnType<typeof useSession>);
  });

  it('fails closed when a form has no edit privilege metadata', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: { results: [form('missing-metadata'), form('allowed', 'Edit Form')] },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useGetAllForms(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.forms?.map(({ uuid }) => uuid)).toEqual(['allowed']);
  });

  it('includes a form only when its valid edit privilege is assigned', async () => {
    mockOpenmrsFetch.mockResolvedValue({
      data: { results: [form('allowed', 'Edit Form'), form('denied', 'Other Form Privilege')] },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useGetAllForms(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.forms?.map(({ uuid }) => uuid)).toEqual(['allowed']);
  });

  it('uses the generic clinical-forms edit capability for legacy metadata', async () => {
    const genericEditPrivilege = 'app:hoja.clinica.formulariosClinicos.editar';
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: {
        uuid: 'user-uuid',
        privileges: [{ uuid: 'generic-edit', name: genericEditPrivilege, display: genericEditPrivilege }],
        roles: [],
      },
    } as ReturnType<typeof useSession>);
    mockOpenmrsFetch.mockResolvedValue({
      data: { results: [form('legacy-form')] },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    const { result } = renderHook(() => useGetAllForms(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.forms?.map(({ uuid }) => uuid)).toEqual(['legacy-form']);
  });
});
