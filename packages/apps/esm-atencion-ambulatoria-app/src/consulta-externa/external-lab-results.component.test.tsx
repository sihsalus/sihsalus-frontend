import { navigate, openmrsFetch } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import ExternalLabResults, { netlabPortalUrls } from './external-lab-results.component';

const deniedPrivileges = vi.hoisted(() => new Set<string>());
vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ children, privilege }: PropsWithChildren<{ privilege: string }>) =>
    deniedPrivileges.has(privilege) ? null : children,
}));

describe('External laboratory reports', () => {
  beforeEach(() => {
    deniedPrivileges.clear();
    vi.mocked(navigate).mockClear();
    vi.mocked(openmrsFetch).mockClear();
  });

  it('opens only public INS portals without patient identifiers, referrer or opener access', async () => {
    const user = userEvent.setup();
    render(<ExternalLabResults patientUuid="synthetic-patient-a" />);
    await user.click(screen.getByRole('button', { name: 'External laboratory reports' }));

    for (const [index, url] of Object.values(netlabPortalUrls).entries()) {
      const link = screen.getByRole('link', { name: `Netlab ${index + 1} (opens in a new tab)` });
      expect(link).toHaveAttribute('href', url);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
      expect(url).not.toContain('synthetic-patient-a');
      expect(new URL(url).search).toBe('');
    }
    expect(screen.getByText(/does not create structured results/)).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(openmrsFetch).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the existing attachments permission without hiding general guidance', async () => {
    deniedPrivileges.add('app:hoja.clinica.adjuntos');
    const user = userEvent.setup();
    render(<ExternalLabResults patientUuid="synthetic-patient-a" />);
    await user.click(screen.getByRole('button', { name: 'External laboratory reports' }));

    expect(screen.queryByRole('button', { name: 'View attached reports' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Netlab 1 (opens in a new tab)' })).toBeVisible();
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it('uses the current patient when navigating without creating or selecting a visit', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ExternalLabResults patientUuid="synthetic-patient-a" />);
    await user.click(screen.getByRole('button', { name: 'External laboratory reports' }));
    rerender(<ExternalLabResults patientUuid="synthetic-patient-b" />);
    await user.click(screen.getByRole('button', { name: 'View attached reports' }));

    expect(navigate).toHaveBeenCalledExactlyOnceWith({
      to: `\${openmrsSpaBase}/patient/synthetic-patient-b/chart/Attachments`,
    });
    expect(openmrsFetch).not.toHaveBeenCalled();
  });
});
