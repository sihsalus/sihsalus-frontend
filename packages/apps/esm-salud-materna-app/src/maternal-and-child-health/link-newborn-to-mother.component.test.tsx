import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MotherAndChildLink, NewbornPatient } from './mother-child-relationship.resource';
import { LabourDelivery } from './labour-delivery.component';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  links: vi.fn(),
  search: vi.fn(),
  session: { authenticated: true, user: { uuid: 'synthetic-user' } },
  config: { motherChildRelationshipTypeUuid: '00000000-0000-4000-a000-000000000003' },
  privileges: ['app:hoja.clinica', 'app:hoja.clinica.partoPuerperio.editar', 'Add Relationships'],
}));

vi.mock('@openmrs/esm-framework', () => ({
  useConfig: () => mocks.config,
  useSession: () => mocks.session,
  userHasAccess: (privilege: string) => mocks.privileges.includes(privilege),
  usePatient: () => ({}),
  BabyIcon: () => null,
}));

vi.mock('@openmrs/esm-patient-common-lib', () => ({ TabbedDashboard: () => null }));
vi.mock('./mother-child-relationship.resource', () => ({
  createMotherChildRelationship: mocks.create,
  useMotherAndChildLinks: mocks.links,
  useNewbornPatientSearch: mocks.search,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, string>) =>
      fallback.replace(/\{\{(\w+)\}\}/g, (_match, key) => values?.[key] ?? ''),
  }),
}));

const motherUuid = 'synthetic-mother';
const newborn: NewbornPatient = {
  uuid: 'synthetic-newborn-patient',
  person: { uuid: 'synthetic-newborn-person', display: 'RN Sintético', birthdate: '2026-10-05' },
  identifiers: [{ identifier: 'SYNTHETIC-001', preferred: true }],
};

function linkState(
  overrides: { data?: MotherAndChildLink[]; error?: Error; isLoading?: boolean; isValidating?: boolean } = {},
) {
  return {
    data: [] as MotherAndChildLink[] | undefined,
    error: undefined as Error | undefined,
    isLoading: false,
    isValidating: false,
    mutate: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

let motherLinks: ReturnType<typeof linkState>;
let childLinks: ReturnType<typeof linkState>;

function chart(uuid = motherUuid) {
  return <LabourDelivery patient={{ resourceType: 'Patient', id: uuid }} patientUuid={uuid} />;
}

async function openAndSelect() {
  const user = userEvent.setup();
  const view = render(chart());
  await user.click(screen.getByRole('button', { name: 'Vincular recién nacido' }));
  await user.type(screen.getByRole('textbox', { name: 'Buscar recién nacido registrado' }), 'RN Sintético');
  await user.click(screen.getByRole('radio', { name: /RN Sintético/ }));
  return { user, ...view };
}

function confirmButton() {
  return screen.getByRole('button', { name: 'Confirmar vínculo' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.authenticated = true;
  mocks.config.motherChildRelationshipTypeUuid = '00000000-0000-4000-a000-000000000003';
  mocks.privileges = ['app:hoja.clinica', 'app:hoja.clinica.partoPuerperio.editar', 'Add Relationships'];
  motherLinks = linkState();
  childLinks = linkState();
  mocks.links.mockImplementation((query) => (query.motherUuid ? motherLinks : childLinks));
  mocks.search.mockImplementation((query: string) => ({
    patients: query.trim().length >= 3 ? [newborn] : [],
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  }));
  mocks.create.mockResolvedValue({ data: { uuid: 'synthetic-relationship' } });
});

it.each(['app:hoja.clinica', 'app:hoja.clinica.partoPuerperio.editar', 'Add Relationships'])(
  'does not offer linking without %s',
  (privilege) => {
    mocks.privileges = mocks.privileges.filter((item) => item !== privilege);
    render(chart());
    expect(screen.queryByRole('button', { name: 'Vincular recién nacido' })).not.toBeInTheDocument();
    expect(mocks.links).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  },
);

it('does not offer linking for an unauthenticated session', () => {
  mocks.session.authenticated = false;
  render(chart());
  expect(screen.queryByRole('button', { name: 'Vincular recién nacido' })).not.toBeInTheDocument();
  expect(mocks.search).not.toHaveBeenCalled();
});

it('checks the patient UUID, creates the directional person relationship, and confirms only a saved UUID', async () => {
  const { user } = await openAndSelect();
  expect(mocks.links).toHaveBeenCalledWith({ childUuid: newborn.uuid }, true);
  expect(screen.getByRole('radio', { name: /SYNTHETIC-001/ })).toBeChecked();
  await user.click(confirmButton());
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
    motherUuid,
    newborn.person?.uuid,
    mocks.config.motherChildRelationshipTypeUuid,
  );
  expect(await screen.findByText('Vínculo madre-hijo guardado.')).toBeInTheDocument();
  expect(motherLinks.mutate).toHaveBeenCalledOnce();
  expect(confirmButton()).toBeDisabled();
});

it('disables a newborn already linked in the mother list', async () => {
  motherLinks = linkState({ data: [{ mother: { uuid: motherUuid }, child: { uuid: newborn.uuid } }] });
  await openAndSelect();
  expect(screen.getByRole('radio', { name: /RN Sintético/ })).toBeDisabled();
  expect(confirmButton()).toBeDisabled();
  expect(mocks.create).not.toHaveBeenCalled();
});

it('blocks a duplicate reported by the child query when the mother list is stale', async () => {
  childLinks = linkState({ data: [{ mother: { uuid: motherUuid }, child: { uuid: newborn.uuid } }] });
  await openAndSelect();
  expect(screen.getByText('Este recién nacido ya está vinculado a la madre.')).toBeInTheDocument();
  expect(confirmButton()).toBeDisabled();
  expect(mocks.create).not.toHaveBeenCalled();
});

it('blocks a child who already has a different mother', async () => {
  childLinks = linkState({ data: [{ mother: { uuid: 'another-synthetic-mother' }, child: { uuid: newborn.uuid } }] });
  await openAndSelect();
  expect(screen.getByText('Este recién nacido ya está vinculado a otra madre.')).toBeInTheDocument();
  expect(confirmButton()).toBeDisabled();
  expect(mocks.create).not.toHaveBeenCalled();
});

describe.each(['mother', 'child'] as const)('unavailable %s relationships', (scope) => {
  it.each(['loading', 'refreshing', 'error'] as const)('does not save while %s', async (state) => {
    const view = await openAndSelect();
    const response = scope === 'mother' ? motherLinks : childLinks;
    response.data = undefined;
    response.isLoading = state === 'loading';
    response.isValidating = state === 'refreshing';
    response.error = state === 'error' ? new Error('private backend detail') : undefined;
    view.rerender(chart());
    expect(confirmButton()).toBeDisabled();
    expect(screen.queryByText('private backend detail')).not.toBeInTheDocument();
    await view.user.click(confirmButton());
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

it('requires a configured relationship type', async () => {
  mocks.config.motherChildRelationshipTypeUuid = '';
  await openAndSelect();
  expect(screen.getByText('No se configuró el tipo de relación madre-hijo.')).toBeInTheDocument();
  expect(confirmButton()).toBeDisabled();
});

it.each(['rejected', 'missing UUID'])(
  'locks an unconfirmed %s write without showing backend details',
  async (failure) => {
    if (failure === 'rejected') {
      mocks.create.mockRejectedValue(new Error('private backend detail'));
    } else {
      mocks.create.mockResolvedValue({ data: {} });
    }
    const { user } = await openAndSelect();
    await user.click(confirmButton());
    expect(await screen.findByText('No se pudo confirmar el vínculo.')).toBeInTheDocument();
    expect(screen.queryByText('Vínculo madre-hijo guardado.')).not.toBeInTheDocument();
    expect(screen.queryByText('private backend detail')).not.toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('radio', { name: /RN Sintético/ })).toBeDisabled();
    expect(motherLinks.mutate).toHaveBeenCalledOnce();
  },
);

it('allows only one pending write and prevents closing until its outcome is known', async () => {
  let resolveWrite: (response: { data: { uuid: string } }) => void = () => {};
  mocks.create.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveWrite = resolve;
      }),
  );
  const { user } = await openAndSelect();
  const submit = confirmButton();
  fireEvent.click(submit);
  fireEvent.click(submit);
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(submit).toBeDisabled();
  expect(screen.getByText('Cancelar', { selector: 'button' })).toBeDisabled();
  await user.click(screen.getByLabelText('Cancelar', { selector: 'button' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await act(async () => resolveWrite({ data: { uuid: 'synthetic-relationship' } }));
  expect(await screen.findByText('Vínculo madre-hijo guardado.')).toBeInTheDocument();
});

it('drops the previous selection on patient context changes', async () => {
  const view = await openAndSelect();
  view.rerender(chart('another-synthetic-mother'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await view.user.click(screen.getByRole('button', { name: 'Vincular recién nacido' }));
  expect(screen.getByRole('textbox')).toHaveValue('');
  expect(confirmButton()).toBeDisabled();
  expect(mocks.create).not.toHaveBeenCalled();
});

it('closes the selector when the session expires', async () => {
  const view = await openAndSelect();
  mocks.session.authenticated = false;
  view.rerender(chart());
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(mocks.create).not.toHaveBeenCalled();
});

it('clears a selection when the search changes', async () => {
  const { user } = await openAndSelect();
  await user.clear(screen.getByRole('textbox'));
  expect(confirmButton()).toBeDisabled();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
});
