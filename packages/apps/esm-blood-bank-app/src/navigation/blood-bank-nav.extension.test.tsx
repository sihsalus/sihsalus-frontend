import { navigate } from '@openmrs/esm-framework';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bloodBankPrivileges } from '../access/blood-bank-privileges';
import BloodBankNav from './blood-bank-nav.extension';

const allowedPrivileges = vi.hoisted(() => new Set<string>());

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ privilege, children, hideUnauthorized, fallback }: { privilege: string; children: ReactNode; hideUnauthorized?: boolean; fallback?: ReactNode }) =>
    allowedPrivileges.has(privilege) ? children : hideUnauthorized ? null : fallback ?? null,
}));

describe('BloodBankNav', () => {
  beforeEach(() => allowedPrivileges.clear());

  it('muestra únicamente los enlaces autorizados en el slot compartido', () => {
    allowedPrivileges.add(bloodBankPrivileges.module);
    allowedPrivileges.add(bloodBankPrivileges.donors);
    render(<BloodBankNav />);

    expect(screen.getByRole('link', { name: 'Inicio' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Donantes' })).toHaveAttribute('href', '/openmrs/spa/blood-bank/donors');
    expect(screen.queryByRole('link', { name: 'Inventario' })).not.toBeInTheDocument();
    expect(screen.queryByText('Laboratorio')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Donantes' }));
    expect(vi.mocked(navigate)).toHaveBeenCalledWith({ to: '/openmrs/spa/blood-bank/donors' });
  });

  it('muestra el grupo cuando solo se autoriza una subsección', () => {
    allowedPrivileges.add(bloodBankPrivileges.compatibility);
    render(<BloodBankNav />);

    expect(screen.getByText('Laboratorio')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compatibilidad' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Tamizaje' })).not.toBeInTheDocument();
  });

  it('muestra los nombres breves de las subsecciones autorizadas', () => {
    allowedPrivileges.add(bloodBankPrivileges.screening);
    allowedPrivileges.add(bloodBankPrivileges.donorFollowUp);
    allowedPrivileges.add(bloodBankPrivileges.recipientFollowUp);
    render(<BloodBankNav />);

    expect(screen.getByRole('link', { name: 'Tamizaje' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Al donante' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Al receptor' })).toBeInTheDocument();
  });
});
