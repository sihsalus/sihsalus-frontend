import { useConnectivity, useSession } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import { renderWithSwr } from 'test-utils';

import type { Form } from '../types';

import { useDynamicFormDataEntries } from './offline-form-helpers';
import OfflineForms from './offline-forms.component';
import { useValidOfflineFormEncounters } from './use-offline-form-encounters';

vi.mock('./use-offline-form-encounters', () => ({
  useValidOfflineFormEncounters: vi.fn(),
}));

vi.mock('./offline-form-helpers', () => ({
  putDynamicFormDataEntryFor: vi.fn(),
  removeDynamicFormDataEntryFor: vi.fn(),
  useDynamicFormDataEntries: vi.fn(),
}));

const mockUseConnectivity = vi.mocked(useConnectivity);
const mockUseDynamicFormDataEntries = vi.mocked(useDynamicFormDataEntries);
const mockUseSession = vi.mocked(useSession);
const mockUseValidOfflineFormEncounters = vi.mocked(useValidOfflineFormEncounters);

const form = (uuid: string, editPrivilege?: string): Form => ({
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
    viewPrivilege: null,
    editPrivilege: editPrivilege
      ? { uuid: `${editPrivilege}-uuid`, name: editPrivilege, display: editPrivilege }
      : null,
  },
});

describe('OfflineForms privilege filtering', () => {
  beforeEach(() => {
    mockUseConnectivity.mockReturnValue(true);
    mockUseDynamicFormDataEntries.mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as unknown as ReturnType<typeof useDynamicFormDataEntries>);
    mockUseValidOfflineFormEncounters.mockReturnValue({
      data: [form('missing-metadata'), form('allowed', 'Edit Form')],
      error: undefined,
    } as ReturnType<typeof useValidOfflineFormEncounters>);
  });

  it('hides offline controls without metadata and shows a form with an assigned edit privilege', async () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: {
        uuid: 'user-uuid',
        privileges: [{ uuid: 'edit-form', name: 'Edit Form', display: 'Edit Form' }],
        roles: [],
      },
    } as ReturnType<typeof useSession>);

    renderWithSwr(<OfflineForms />);

    expect(await screen.findByText('allowed')).toBeInTheDocument();
    expect(screen.queryByText('missing-metadata')).not.toBeInTheDocument();
  });

  it('shows no offline controls when the valid edit privilege is not assigned', async () => {
    mockUseSession.mockReturnValue({
      authenticated: true,
      user: { uuid: 'user-uuid', privileges: [], roles: [] },
    } as ReturnType<typeof useSession>);

    renderWithSwr(<OfflineForms />);

    expect(await screen.findByTitle(/empty data illustration/i)).toBeInTheDocument();
    expect(screen.queryByText('allowed')).not.toBeInTheDocument();
  });
});
