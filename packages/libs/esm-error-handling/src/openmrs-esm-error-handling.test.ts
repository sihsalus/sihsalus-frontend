import { dispatchToastShown } from '@openmrs/esm-globals';
import { describe, expect, it, vi } from 'vitest';
import { reportError } from './index';

vi.mock('@openmrs/esm-globals', () => ({
  dispatchToastShown: vi.fn(),
}));

vi.useFakeTimers();

describe('error handler', () => {
  it('transforms non-Error inputs into valid Error objects', () => {
    expect(() => {
      reportError('error');
      vi.runAllTimers();
    }).toThrow('error');

    expect(() => {
      reportError({ error: 'error' });
      vi.runAllTimers();
    }).toThrow('Object thrown as error: {"error":"error"}');

    expect(() => {
      reportError(null);
      vi.runAllTimers();
    }).toThrow("'null' was thrown as an error");

    expect(() => {
      reportError(undefined);
      vi.runAllTimers();
    }).toThrow("'undefined' was thrown as an error");
  });

  it('shows a user-facing message for microfrontend load failures', () => {
    window.onerror?.(
      "application '@sihsalus/esm-patient-chart-app-page-0' died in status LOADING_SOURCE_CODE: Shared module single-spa-react doesn't exist in shared scope default",
      '',
      0,
      0,
      undefined,
    );

    expect(dispatchToastShown).toHaveBeenCalledWith({
      description:
        'No se pudo cargar un módulo de la aplicación. Recarga la página. Si el problema continúa, contacta a soporte.',
      kind: 'error',
      title: 'No se pudo cargar la página',
    });
  });

  it('keeps regular error messages visible', () => {
    window.onunhandledrejection?.({ reason: new Error('Regular failure') } as PromiseRejectionEvent);

    expect(dispatchToastShown).toHaveBeenCalledWith({
      description: 'Regular failure',
      kind: 'error',
      title: 'Error',
    });
  });
});
