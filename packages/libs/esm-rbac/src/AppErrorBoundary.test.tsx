import { render, screen } from '@testing-library/react';
import { reportError } from '@openmrs/esm-framework';
import { auditLogger } from '@sihsalus/esm-audit-logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorBoundary } from './AppErrorBoundary';

vi.mock('@openmrs/esm-framework', () => ({
  reportError: vi.fn(),
}));

vi.mock('@sihsalus/esm-audit-logger', () => ({
  auditLogger: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

const sensitiveTechnicalMessage = 'SQLSTATE 23505 patient_identifier_unique /internal/database/path';

function BrokenClinicalWidget(): never {
  throw new Error(sensitiveTechnicalMessage);
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    vi.mocked(reportError).mockClear();
    vi.mocked(auditLogger.log).mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('reports the exception without exposing technical details to the user', () => {
    render(
      <AppErrorBoundary appName="clinical-module">
        <BrokenClinicalWidget />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('No se pudo mostrar esta sección.')).toBeTruthy();
    expect(screen.getByText('Recargar página')).toBeTruthy();
    expect(screen.queryByText(sensitiveTechnicalMessage)).toBeNull();
    expect(screen.queryByText(/clinical-module/u)).toBeNull();
    expect(reportError).toHaveBeenCalledOnce();
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'UNHANDLED_ERROR',
        metadata: expect.objectContaining({
          appName: 'clinical-module',
          message: sensitiveTechnicalMessage,
        }),
      }),
    );
  });
});
