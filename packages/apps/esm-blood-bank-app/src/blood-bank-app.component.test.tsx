import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bloodBankPrivileges } from './access/blood-bank-privileges';
import { mockBloodBankApi } from './api/mock-blood-bank.api';
import type { BloodBankApi } from './api/blood-bank.api';
import { BloodBankApp } from './blood-bank-app.component';

const allowedPrivileges = vi.hoisted(() => new Set<string>());

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ privilege, children, hideUnauthorized, fallback }: { privilege: string; children: ReactNode; hideUnauthorized?: boolean; fallback?: ReactNode }) =>
    allowedPrivileges.has(privilege) ? children : hideUnauthorized ? null : fallback ?? <div>Sin acceso</div>,
}));

describe('BloodBankApp', () => {
  beforeEach(() => allowedPrivileges.clear());

  it('muestra el inicio integrado con datos sintéticos', async () => {
    render(<BloodBankApp api={mockBloodBankApi} />);

    expect(await screen.findByRole('heading', { name: 'Inicio' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Resumen operativo' })).toBeInTheDocument();
  });

  it('permite abrir una sección mediante ruta interna', async () => {
    allowedPrivileges.add(bloodBankPrivileges.compatibility);
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/laboratory/compatibility" />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Compatibilidad' })).toBeInTheDocument();
  });

  it('muestra un error seguro cuando la API falla', async () => {
    const failingApi: BloodBankApi = {
      getDashboard: () => Promise.reject(new Error('technical backend detail')),
      getDonors: () => Promise.resolve([]),
      getInventory: () => Promise.resolve([]),
    };

    render(<BloodBankApp api={failingApi} />);

    expect(await screen.findByText('No se pudieron cargar los datos')).toBeInTheDocument();
    expect(screen.queryByText('technical backend detail')).not.toBeInTheDocument();
  });

  it('bloquea la URL directa cuando falta el privilegio de la sección', () => {
    allowedPrivileges.add(bloodBankPrivileges.module);
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/inventory" />);

    expect(screen.getByText('Sin acceso')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Inventario' })).not.toBeInTheDocument();
  });

  it('permite solo la subsección autorizada de laboratorio', async () => {
    allowedPrivileges.add(bloodBankPrivileges.module);
    allowedPrivileges.add(bloodBankPrivileges.compatibility);
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/laboratory/compatibility" />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Compatibilidad' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Tamizaje de donantes' })).not.toBeInTheDocument();
  });

  it('separa el seguimiento del donante y el del receptor', async () => {
    allowedPrivileges.add(bloodBankPrivileges.module);
    allowedPrivileges.add(bloodBankPrivileges.recipientFollowUp);
    render(<BloodBankApp api={mockBloodBankApi} initialPath="/follow-up/recipient" />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Seguimiento del receptor' })).toBeInTheDocument();
  });
});
