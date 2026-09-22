import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import routes from './routes.json';

describe('Laboratory result action destinations', () => {
  it.each([
    ['edit-lab-results-modal', 'editLabResultsModal', 'app:home.laboratorio.editar'],
    ['print-lab-results-modal', 'printLabResultsModal', 'app:home.laboratorio'],
  ])('registers %s with an exported lifecycle and its own privilege', (name, component, privileges) => {
    const registeredRoutes = routes as { modals?: Array<{ name: string; component: string; privileges: string }> };
    expect(registeredRoutes.modals?.find((modal) => modal.name === name)).toEqual({ name, component, privileges });
    expect(readFileSync(resolve(__dirname, 'index.ts'), 'utf8')).toContain(`export const ${component} =`);
  });
});
