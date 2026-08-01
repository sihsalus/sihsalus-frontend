import { openmrsFetch, useConfig, useSession } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';

import type { ConfigObject } from '../config-schema';
import { clinicalFormsEditPrivilege } from '../constants';
import type { Form } from '../types';

import { useForms } from './use-forms';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseSession = vi.mocked(useSession);

const form = (uuid: string, editPrivilege?: string, viewPrivilege?: string): Form => ({
  uuid,
  name: uuid,
  display: uuid,
  version: '1',
  published: true,
  retired: false,
  resources: [],
  encounterType: {
    uuid: `${uuid}-encounter-type`,
    name: `${uuid} encounter`,
    viewPrivilege: viewPrivilege
      ? { uuid: `${viewPrivilege}-uuid`, name: viewPrivilege, display: viewPrivilege }
      : null,
    editPrivilege: editPrivilege
      ? { uuid: `${editPrivilege}-uuid`, name: editPrivilege, display: editPrivilege }
      : null,
  },
});

const wrapper = ({ children }: PropsWithChildren) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

describe('useForms privilege filtering', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      customFormsUrl: '',
      formSections: [],
      htmlFormEntryForms: [],
      orderBy: 'name',
      showHtmlFormEntryForms: true,
    });
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: {
        uuid: 'user-uuid',
        privileges: [{ uuid: 'edit-form', name: 'Edit Form', display: 'Edit Form' }],
        roles: [],
      },
    } as ReturnType<typeof useSession>);
  });

  it('hides online forms without edit privilege metadata and keeps an authorized form', async () => {
    mockOpenmrsFetch.mockImplementation(
      (url) =>
        Promise.resolve(
          String(url).includes('/encounter?')
            ? { data: { results: [] } }
            : { data: { results: [form('missing-metadata'), form('allowed', 'Edit Form')] } },
        ) as ReturnType<typeof openmrsFetch>,
    );

    const { result } = renderHook(() => useForms('patient-uuid'), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map(({ form }) => form.uuid)).toEqual(['allowed']);
  });

  it('hides forms when their valid edit privilege is not assigned', async () => {
    mockOpenmrsFetch.mockImplementation(
      (url) =>
        Promise.resolve(
          String(url).includes('/encounter?')
            ? { data: { results: [] } }
            : { data: { results: [form('denied', 'Other Form Privilege')] } },
        ) as ReturnType<typeof openmrsFetch>,
    );

    const { result } = renderHook(() => useForms('patient-uuid'), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual([]);
  });

  it('uses the explicit generic edit capability for legacy encounter types without metadata', async () => {
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
    mockOpenmrsFetch.mockImplementation(
      (url) =>
        Promise.resolve(
          String(url).includes('/encounter?')
            ? { data: { results: [] } }
            : { data: { results: [form('legacy-form')] } },
        ) as ReturnType<typeof openmrsFetch>,
    );

    const { result } = renderHook(() => useForms('patient-uuid'), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map(({ form }) => form.uuid)).toEqual(['legacy-form']);
  });

  it('does not expose previous encounter metadata without the configured view privilege', async () => {
    mockOpenmrsFetch.mockImplementation(
      (url) =>
        Promise.resolve(
          String(url).includes('/encounter?')
            ? {
                data: {
                  results: [
                    {
                      uuid: 'restricted-encounter',
                      encounterDatetime: '2026-07-31T10:00:00-05:00',
                      form: { uuid: 'allowed' },
                    },
                  ],
                },
              }
            : { data: { results: [form('allowed', 'Edit Form', 'View Form')] } },
        ) as ReturnType<typeof openmrsFetch>,
    );

    const { result } = renderHook(() => useForms('patient-uuid'), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.[0]).toEqual(
      expect.objectContaining({ associatedEncounters: [], lastCompletedDate: undefined }),
    );
  });

  it('shows previous encounter metadata with the configured view privilege', async () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: {
        uuid: 'user-uuid',
        privileges: [
          { uuid: 'edit-form', name: 'Edit Form', display: 'Edit Form' },
          { uuid: 'view-form', name: 'View Form', display: 'View Form' },
        ],
        roles: [],
      },
    } as ReturnType<typeof useSession>);
    mockOpenmrsFetch.mockImplementation(
      (url) =>
        Promise.resolve(
          String(url).includes('/encounter?')
            ? {
                data: {
                  results: [
                    {
                      uuid: 'visible-encounter',
                      encounterDatetime: '2026-07-31T10:00:00-05:00',
                      form: { uuid: 'allowed' },
                    },
                  ],
                },
              }
            : { data: { results: [form('allowed', 'Edit Form', 'View Form')] } },
        ) as ReturnType<typeof openmrsFetch>,
    );

    const { result } = renderHook(() => useForms('patient-uuid'), { wrapper });

    await waitFor(() => expect(result.current.data?.[0]?.associatedEncounters).toHaveLength(1));
    expect(result.current.data?.[0]?.associatedEncounters[0]?.uuid).toBe('visible-encounter');
  });
});
