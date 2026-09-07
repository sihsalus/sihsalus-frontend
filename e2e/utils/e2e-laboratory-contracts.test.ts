import path from 'node:path';
import { type Page } from '@playwright/test';
import { describe, expect, it, vi } from 'vitest';
import { LaboratoryPage } from '../laboratory/pages/laboratory-page';
import laboratoryConfig from '../laboratory/playwright.config';

describe('laboratory selectors and authentication state', () => {
  it('selects an exact normalized patient cell rather than interpreting the name as a regular expression', () => {
    const cell = {};
    const filter = vi.fn().mockReturnValue({});
    const getByRole = vi.fn((role: string) => (role === 'cell' ? cell : { filter }));
    const laboratory = new LaboratoryPage({ getByRole } as unknown as Page);

    laboratory.getPatientRow(' E2E   Synthetic [A].* ');

    expect(getByRole).toHaveBeenCalledWith('cell', { name: 'E2E Synthetic [A].*', exact: true });
    expect(filter).toHaveBeenCalledWith({ has: cell });
  });

  it('rejects an empty patient name without constructing a broad cell selector', () => {
    const getByRole = vi.fn().mockReturnValue({ filter: vi.fn() });
    const laboratory = new LaboratoryPage({ getByRole } as unknown as Page);
    expect(() => laboratory.getPatientRow('   ')).toThrow(/nonempty synthetic patient name/);
    expect(getByRole).not.toHaveBeenCalledWith('cell', expect.anything());
  });

  it('uses the same absolute authentication-state path as laboratory global setup', () => {
    expect(laboratoryConfig.use?.storageState).toBe(path.resolve(__dirname, '../laboratory/storageState.json'));
    expect(laboratoryConfig.globalSetup).toBe(path.resolve(__dirname, '../laboratory/core/global-setup.ts'));
  });
});
