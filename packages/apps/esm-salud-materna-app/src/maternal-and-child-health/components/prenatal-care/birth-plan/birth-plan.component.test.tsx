import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import BirthPlan from './birth-plan.component';

const state = vi.hoisted(() => ({
  config: {
    birthPlan: { formUuid: '' },
    formsList: { birthPlanForm: 'OBST-004-FICHA PLAN DE PARTO' },
  },
  hasBirthPlan: false,
  encounterUuid: undefined as string | undefined,
  launch: vi.fn(),
  mutate: vi.fn(),
  resolve: vi.fn(),
}));
vi.mock('@openmrs/esm-framework', async (original) => ({
  ...(await original<typeof import('@openmrs/esm-framework')>()),
  useConfig: () => state.config,
}));
vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('../../../../hooks/useBirthPlan', () => ({
  useBirthPlan: () => ({
    hasBirthPlan: state.hasBirthPlan,
    encounterUuid: state.encounterUuid,
    isLoading: false,
    error: null,
    mutate: state.mutate,
  }),
}));
vi.mock('../../../../hooks/useMaternalFormLauncher', () => ({
  useMaternalFormIdentifierLauncher: (...args: unknown[]) => {
    state.resolve(...args);
    return { launchForm: state.launch };
  },
}));

beforeEach(() => {
  state.config.birthPlan.formUuid = '';
  state.hasBirthPlan = false;
  state.encounterUuid = undefined;
});

it('resolves the configured published name for the explicit patient before creating a plan through the visit launcher', async () => {
  render(<BirthPlan patientUuid="synthetic-mother" />);
  await userEvent.click(screen.getByRole('button', { name: /Crear/i }));
  expect(state.resolve).toHaveBeenCalledWith('OBST-004-FICHA PLAN DE PARTO', 'Plan de Parto', 'synthetic-mother');
  expect(state.launch).toHaveBeenCalledWith('', state.mutate);
});

it('preserves the UUID override, selected encounter and refresh when editing a plan', async () => {
  state.config.birthPlan.formUuid = 'e87c26bf-d318-4475-abfe-3209a5f7e9c6';
  state.hasBirthPlan = true;
  state.encounterUuid = 'synthetic-owned-encounter';
  render(<BirthPlan patientUuid="synthetic-mother" />);
  await userEvent.click(screen.getByRole('button', { name: /Edit/i }));
  expect(state.resolve).toHaveBeenCalledWith(state.config.birthPlan.formUuid, 'Plan de Parto', 'synthetic-mother');
  expect(state.launch).toHaveBeenCalledWith('synthetic-owned-encounter', state.mutate);
});
