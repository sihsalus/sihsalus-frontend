import { logError, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import enTranslations from '../../translations/en.json';
import esTranslations from '../../translations/es.json';
import type { RegistrationConfig } from '../config-schema';
import { fetchFreshPatientIdentifierTypesWithSources, type Resources, ResourcesContext } from '../offline.resources';
import BulkPatientImport from './bulk-patient-import.component';
import type { ParsedPatientImportRow, PatientImportManifest } from './bulk-patient-import.types';
import {
  calculateFileSha256,
  createPatientFromImportRow,
  downloadImportReport,
  downloadSantaClotildeTemplate,
  parseSantaClotildeWorkbook,
  preflightBulkPatientImportRows,
} from './bulk-patient-import.utils';
import {
  assertFreshBulkPatientImportContext,
  bulkPatientImportSafetyErrorMessage,
  withBulkPatientImportLock,
} from './bulk-patient-import-runner';

vi.mock('./bulk-patient-import-runner', () => ({
  assertFreshBulkPatientImportContext: vi.fn(),
  bulkPatientImportSafetyErrorMessage:
    'The bulk patient import safety check failed. No additional patients were created.',
  withBulkPatientImportLock: vi.fn(async (operation: () => Promise<unknown>) => operation()),
}));

vi.mock('../offline.resources', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../offline.resources')>()),
  fetchFreshPatientIdentifierTypesWithSources: vi.fn(),
}));

vi.mock('./bulk-patient-import.utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./bulk-patient-import.utils')>();
  return {
    ...actual,
    calculateFileSha256: vi.fn(),
    createPatientFromImportRow: vi.fn(),
    downloadImportReport: vi.fn(),
    downloadSantaClotildeTemplate: vi.fn(),
    parseSantaClotildeWorkbook: vi.fn(),
    preflightBulkPatientImportRows: vi.fn(),
  };
});

const mockAssertFreshContext = vi.mocked(assertFreshBulkPatientImportContext);
const mockCalculateFileSha256 = vi.mocked(calculateFileSha256);
const mockCreatePatientFromImportRow = vi.mocked(createPatientFromImportRow);
const mockDownloadImportReport = vi.mocked(downloadImportReport);
const mockDownloadTemplate = vi.mocked(downloadSantaClotildeTemplate);
const mockFetchFreshIdentifierTypes = vi.mocked(fetchFreshPatientIdentifierTypesWithSources);
const mockLogError = vi.mocked(logError);
const mockParseSantaClotildeWorkbook = vi.mocked(parseSantaClotildeWorkbook);
const mockPreflightRows = vi.mocked(preflightBulkPatientImportRows);
const mockUseConfig = vi.mocked(useConfig<RegistrationConfig>);
const mockWithLock = vi.mocked(withBulkPatientImportLock);
const mockShowSnackbar = vi.mocked(showSnackbar);
const approvedFileSha256 = 'a'.repeat(64);
const approvedUserUuid = '11111111-1111-4111-8111-111111111111';
const approvedLocationUuid = '22222222-2222-4222-8222-222222222222';
const deterministicPatientUuid = '9b840936-a975-594c-9ff0-a7e9bffc7161';

const validRow: ParsedPatientImportRow = {
  id: `${approvedFileSha256}:2`,
  rowNumber: 2,
  raw: {
    ORDEN: '1',
    DNI: '11111111',
    SEXO: 'F',
    'F.N.': '01/01/1990',
    'A.PATERNO': 'SYNTHETIC',
    'A.MATERNO': 'PATIENT',
    NOMBRES: 'TEST',
    PARENTESCO: '',
    DOMICILIO: 'SYNTHETIC ADDRESS',
  },
  normalized: {
    orden: '1',
    dni: '11111111',
    gender: 'F',
    birthdate: '1990-01-01',
    familyName: 'SYNTHETIC',
    familyName2: 'PATIENT',
    givenName: 'TEST',
    middleName: '',
    parentesco: '',
    domicilio: 'SYNTHETIC ADDRESS',
  },
  errors: [],
  warnings: [],
  status: 'valid',
  patientUuid: deterministicPatientUuid,
};

const manifest: PatientImportManifest = {
  schemaVersion: 1,
  fileName: 'approved.xlsx',
  fileSize: 1024,
  fileSha256: approvedFileSha256,
  rows: [validRow],
};

const resources = {
  currentSession: {
    authenticated: true,
    user: { uuid: approvedUserUuid },
    sessionLocation: { uuid: approvedLocationUuid },
  },
  identifierTypes: [{ uuid: 'dni-type-uuid' }],
  isLoadingIdentifierTypes: false,
} as Resources;

const config = {
  bulkPatientImport: {
    enabled: true,
    approvedBuildSha: 'b'.repeat(40),
    approvedFileSha256,
    approvalExpiresAt: '2099-01-01T00:00:00.000Z',
    approvedLocationUuid,
    approvedOrigin: globalThis.location.origin,
    approvedUserUuid,
    domicilioTarget: 'address4',
  },
} as RegistrationConfig;

describe('BulkPatientImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue(config);
    mockAssertFreshContext.mockResolvedValue(undefined);
    mockCalculateFileSha256.mockResolvedValue(approvedFileSha256);
    mockFetchFreshIdentifierTypes.mockResolvedValue(resources.identifierTypes);
    mockPreflightRows.mockResolvedValue({ reconciledRowIds: new Set() });
    mockCreatePatientFromImportRow.mockResolvedValue({ patientUuid: deterministicPatientUuid, outcome: 'created' });
    mockDownloadImportReport.mockResolvedValue(undefined);
    mockDownloadTemplate.mockResolvedValue(undefined);
  });

  it('fails closed on the direct route after the approval window expires', () => {
    mockUseConfig.mockReturnValue({
      ...config,
      bulkPatientImport: { ...config.bulkPatientImport, approvalExpiresAt: '2020-01-01T00:00:00.000Z' },
    });

    renderBulkPatientImport();

    expect(screen.getByText('This import context is not approved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload excel/i })).not.toBeInTheDocument();
    expect(mockAssertFreshContext).not.toHaveBeenCalled();
  });

  it('hides and clears a loaded manifest when the one-time approval expires on the open page', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-21T12:00:00.000Z'));
      mockUseConfig.mockReturnValue({
        ...config,
        bulkPatientImport: { ...config.bulkPatientImport, approvalExpiresAt: '2026-08-21T12:00:01.000Z' },
      });
      mockParseSantaClotildeWorkbook.mockResolvedValue(manifest);

      const rendered = renderBulkPatientImport();
      await act(async () => {
        uploadFile(rendered.container);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByText(validRow.normalized.dni)).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1001));

      expect(screen.getByText('This import context is not approved')).toBeInTheDocument();
      expect(screen.queryByRole('table', { name: /patient import preview/i })).not.toBeInTheDocument();
      expect(screen.queryByText(validRow.normalized.dni)).not.toBeInTheDocument();
      rendered.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows only a fixed safe fallback when workbook parsing fails', async () => {
    mockParseSantaClotildeWorkbook.mockRejectedValue(new Error('private workbook XML and identifier'));

    const { container } = renderBulkPatientImport();
    uploadFile(container);

    expect(await screen.findByText(bulkPatientImportSafetyErrorMessage)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(bulkPatientImportSafetyErrorMessage);
    expect(screen.queryByText(/private workbook XML/i)).not.toBeInTheDocument();
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ message: bulkPatientImportSafetyErrorMessage }),
      'Bulk patient import file parsing failed',
    );
  });

  it('rejects an invalid file before reading or hashing its bytes', async () => {
    const { container } = renderBulkPatientImport();
    uploadFile(container, new File(['not an xlsx'], 'patients.txt'));

    expect(await screen.findByText(bulkPatientImportSafetyErrorMessage)).toBeInTheDocument();
    expect(mockCalculateFileSha256).not.toHaveBeenCalled();
    expect(mockParseSantaClotildeWorkbook).not.toHaveBeenCalled();
  });

  it('blocks a non-approved workbook before any server preflight', async () => {
    mockCalculateFileSha256.mockResolvedValue('c'.repeat(64));

    const { container } = renderBulkPatientImport();
    uploadFile(container);

    expect(await screen.findByText('This file is not approved')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('This file is not approved');
    expect(screen.queryByRole('button', { name: /run safety preflight/i })).not.toBeInTheDocument();
    expect(mockAssertFreshContext).not.toHaveBeenCalled();
    expect(mockParseSantaClotildeWorkbook).not.toHaveBeenCalled();
    expect(mockPreflightRows).not.toHaveBeenCalled();
    expect(mockCreatePatientFromImportRow).not.toHaveBeenCalled();
  });

  it('handles a template download rejection with fixed PHI-safe feedback and disables actions while pending', async () => {
    const templateDownload = deferred<void>();
    mockDownloadTemplate.mockReturnValueOnce(templateDownload.promise);

    renderBulkPatientImport();
    fireEvent.click(screen.getByRole('button', { name: /download template/i }));

    expect(await screen.findByRole('button', { name: /preparing template/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /upload excel/i })).toBeDisabled();
    await act(async () => templateDownload.reject(new Error('private template generation details')));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          title: 'Template download failed',
          subtitle: 'No file was downloaded. Try again; if the problem continues, contact your system administrator.',
        }),
      ),
    );
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'The requested bulk patient import file could not be downloaded.' }),
      'Bulk patient import template download failed',
    );
    expect(screen.queryByText(/private template/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download template/i })).toBeEnabled();
  });

  it('requires a read-only preflight before enabling creation', async () => {
    mockParseSantaClotildeWorkbook.mockResolvedValue(manifest);

    const { container } = renderBulkPatientImport();
    uploadFile(container);
    const preflightButton = await screen.findByRole('button', { name: /run safety preflight/i });
    expect(screen.getByRole('button', { name: /create patients/i })).toBeDisabled();

    fireEvent.click(preflightButton);

    await waitFor(() => expect(mockPreflightRows).toHaveBeenCalledOnce());
    expect(mockFetchFreshIdentifierTypes).toHaveBeenCalledOnce();
    expect(mockCreatePatientFromImportRow).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /create patients/i })).toBeEnabled();
    const previewTable = screen.getByRole('table', { name: 'Patient import preview' });
    expect([previewTable, previewTable.parentElement].some((element) => element?.tabIndex === 0)).toBe(true);
    expect(screen.getByRole('region', { name: 'Patient import summary' })).toBeInTheDocument();
    expect(screen.queryByText(/summary and protected report include all rows/i)).not.toBeInTheDocument();
  });

  it('uses fresh identifier metadata even when the cached registration metadata is unavailable', async () => {
    mockParseSantaClotildeWorkbook.mockResolvedValue(manifest);
    const cachedMetadataFailure = {
      ...resources,
      identifierTypes: [],
      identifierTypesError: new Error('stale cached metadata failure'),
    } as Resources;

    const rendered = render(renderBulkPatientImportTree(cachedMetadataFailure));
    uploadFile(rendered.container);
    fireEvent.click(await screen.findByRole('button', { name: /run safety preflight/i }));

    await waitFor(() => expect(mockFetchFreshIdentifierTypes).toHaveBeenCalledOnce());
    expect(mockPreflightRows).toHaveBeenCalledWith(
      manifest.rows,
      resources.identifierTypes,
      approvedLocationUuid,
      expect.objectContaining({ domicilioTarget: 'address4' }),
    );
    expect(screen.getByRole('button', { name: /create patients/i })).toBeEnabled();
    expect(screen.queryByText(/stale cached metadata/i)).not.toBeInTheDocument();
  });

  it('hides and clears the loaded manifest when the approved session identity changes', async () => {
    mockParseSantaClotildeWorkbook.mockResolvedValue(manifest);

    const rendered = renderBulkPatientImport();
    uploadFile(rendered.container);
    expect(await screen.findByText(validRow.normalized.dni)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /run safety preflight/i }));
    const createButton = await screen.findByRole('button', { name: /create patients/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    fireEvent.click(createButton);
    expect(await screen.findByRole('dialog', { name: /create patients/i })).toBeInTheDocument();

    const changedSessionResources = {
      ...resources,
      currentSession: {
        ...resources.currentSession,
        user: { uuid: '33333333-3333-4333-8333-333333333333' },
      },
    } as Resources;
    rendered.rerender(renderBulkPatientImportTree(changedSessionResources));

    expect(screen.getByText('This import context is not approved')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /create patients/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /patient import preview/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download protected report/i })).not.toBeInTheDocument();
    expect(screen.queryByText(validRow.normalized.dni)).not.toBeInTheDocument();

    rendered.rerender(renderBulkPatientImportTree(resources));
    expect(screen.getByRole('button', { name: /upload excel/i })).toBeEnabled();
    expect(screen.queryByRole('table', { name: /patient import preview/i })).not.toBeInTheDocument();
  });

  it('renders row validation feedback through the translation layer', async () => {
    const rawValidationMessage =
      'Los pacientes menores de edad deben registrarse manualmente junto con su responsable.';
    mockParseSantaClotildeWorkbook.mockResolvedValue({
      ...manifest,
      rows: [{ ...validRow, errors: [rawValidationMessage], status: 'error' }],
    });

    const { container } = renderBulkPatientImport();
    uploadFile(container);

    expect(
      await screen.findByText('Patients younger than 18 must be registered manually with their responsible adult.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(rawValidationMessage)).not.toBeInTheDocument();
  });

  it('defines the new safety and validation feedback in both language catalogs', () => {
    const requiredKeys = [
      'bulkPatientImportDownloadFailedSubtitle',
      'bulkPatientImportPreflightFailedSubtitle',
      'bulkPatientImportRevalidating',
      'bulkPatientImportValidationMinor',
      'bulkPatientImportPrivilegeRequired',
    ] as const;

    for (const key of requiredKeys) {
      expect(enTranslations[key]).toBeTruthy();
      expect(esTranslations[key]).toBeTruthy();
    }
    expect(esTranslations.bulkPatientImportValidationMinor).toBe(
      'Los pacientes menores de 18 años deben registrarse manualmente junto con su responsable.',
    );
  });

  it('discloses when the preview is truncated while keeping the full manifest total visible', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      ...validRow,
      id: `${approvedFileSha256}:${index + 2}`,
      rowNumber: index + 2,
    }));
    mockParseSantaClotildeWorkbook.mockResolvedValue({ ...manifest, rows });

    const { container } = renderBulkPatientImport();
    uploadFile(container);

    expect(
      await screen.findByText('Showing the first 100 of 101 rows. The summary and protected report include all rows.'),
    ).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(101);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /download protected report/i })));
    expect(mockDownloadImportReport).toHaveBeenCalledWith(rows);
  });

  it('handles a protected report rejection with fixed PHI-safe feedback and disables actions while pending', async () => {
    const reportDownload = deferred<void>();
    mockParseSantaClotildeWorkbook.mockResolvedValue(manifest);
    mockDownloadImportReport.mockReturnValueOnce(reportDownload.promise);

    const { container } = renderBulkPatientImport();
    uploadFile(container);
    const reportButton = await screen.findByRole('button', { name: /download protected report/i });
    fireEvent.click(reportButton);

    expect(await screen.findByRole('button', { name: /preparing report/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /run safety preflight/i })).toBeDisabled();
    await act(async () => reportDownload.reject(new Error('private report rows and identifiers')));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          title: 'Protected report download failed',
          subtitle: 'No file was downloaded. Try again; if the problem continues, contact your system administrator.',
        }),
      ),
    );
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'The requested bulk patient import file could not be downloaded.' }),
      'Bulk patient import protected report download failed',
    );
    expect(screen.queryByText(/private report/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /download protected report/i })).toBeEnabled();
  });

  it('marks a fully reconciled preflight separately and keeps creation disabled', async () => {
    mockParseSantaClotildeWorkbook.mockResolvedValue(manifest);
    mockPreflightRows.mockResolvedValue({ reconciledRowIds: new Set([validRow.id]) });

    const { container } = renderBulkPatientImport();
    uploadFile(container);
    fireEvent.click(await screen.findByRole('button', { name: /run safety preflight/i }));

    expect(await screen.findByText('Existing patient safely reconciled.')).toBeInTheDocument();
    expectSummaryValue('Created', 0);
    expectSummaryValue('Reconciled', 1);
    expect(screen.getByRole('button', { name: /create patients/i })).toBeDisabled();
    expect(mockCreatePatientFromImportRow).not.toHaveBeenCalled();
  });

  it('fails safely when current identifier metadata cannot be fetched', async () => {
    mockParseSantaClotildeWorkbook.mockResolvedValue(manifest);
    mockFetchFreshIdentifierTypes.mockRejectedValue(new Error('private metadata endpoint details'));

    const { container } = renderBulkPatientImport();
    uploadFile(container);
    fireEvent.click(await screen.findByRole('button', { name: /run safety preflight/i }));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          title: 'Safety preflight failed',
          subtitle:
            'No write was performed. Verify your connection, session, and approved configuration before retrying.',
        }),
      ),
    );
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: expect.stringMatching(/reconcile the current row/i) }),
    );
    expect(screen.queryByText(/private metadata/i)).not.toBeInTheDocument();
    expect(mockPreflightRows).not.toHaveBeenCalled();
    expect(mockCreatePatientFromImportRow).not.toHaveBeenCalled();
  });

  it('labels the approved hash and restores focus to the modal launcher after canceling', async () => {
    mockParseSantaClotildeWorkbook.mockResolvedValue(manifest);

    const { container } = renderBulkPatientImport();
    uploadFile(container);
    fireEvent.click(await screen.findByRole('button', { name: /run safety preflight/i }));
    const createButton = await screen.findByRole('button', { name: /create patients/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    createButton.focus();
    fireEvent.click(createButton);

    const dialog = await screen.findByRole('dialog', { name: /create patients/i });
    expect(within(dialog).getByText('Approved file SHA-256:')).toBeInTheDocument();
    expect(within(dialog).getByText(approvedFileSha256)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /close/i }));

    await waitFor(() => expect(createButton).toHaveFocus());
  });

  it('shows revalidation before row creation and never announces a zero-of-zero creation phase', async () => {
    const lockedPreflight = deferred<{ reconciledRowIds: Set<string> }>();
    const rowCreation = deferred<{ patientUuid: string; outcome: 'created' }>();
    mockParseSantaClotildeWorkbook.mockResolvedValue(manifest);
    mockPreflightRows
      .mockResolvedValueOnce({ reconciledRowIds: new Set() })
      .mockReturnValueOnce(lockedPreflight.promise);
    mockCreatePatientFromImportRow.mockReturnValueOnce(rowCreation.promise);

    const { container } = renderBulkPatientImport();
    uploadFile(container);
    fireEvent.click(await screen.findByRole('button', { name: /run safety preflight/i }));
    const createButton = await screen.findByRole('button', { name: /create patients/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    fireEvent.click(createButton);
    const dialog = await screen.findByRole('dialog', { name: /create patients/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /create/i }));

    expect(await screen.findByText('Re-running safety checks before creating patients...')).toBeInTheDocument();
    expect(screen.queryByText(/Creating 0 of 0 patients/i)).not.toBeInTheDocument();

    await act(async () => lockedPreflight.resolve({ reconciledRowIds: new Set() }));
    expect(await screen.findByText('Creating 1 of 1 patients...')).toBeInTheDocument();
    await act(async () => rowCreation.resolve({ patientUuid: deterministicPatientUuid, outcome: 'created' }));
    await waitFor(() => expect(screen.queryByText(/Creating 1 of 1 patients/i)).not.toBeInTheDocument());
  });

  it('reports a locked preflight rejection as a no-write failure instead of asking to reconcile a row', async () => {
    mockParseSantaClotildeWorkbook.mockResolvedValue(manifest);
    mockPreflightRows
      .mockResolvedValueOnce({ reconciledRowIds: new Set() })
      .mockRejectedValueOnce(new Error('private locked metadata response'));

    const { container } = renderBulkPatientImport();
    uploadFile(container);
    fireEvent.click(await screen.findByRole('button', { name: /run safety preflight/i }));
    const createButton = await screen.findByRole('button', { name: /create patients/i });
    await waitFor(() => expect(createButton).toBeEnabled());
    fireEvent.click(createButton);
    const dialog = await screen.findByRole('dialog', { name: /create patients/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /create$/i }));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          title: 'Safety preflight failed',
          subtitle:
            'No write was performed. Verify your connection, session, and approved configuration before retrying.',
        }),
      ),
    );
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: expect.stringMatching(/reconcile the current row/i) }),
    );
    expect(mockCreatePatientFromImportRow).not.toHaveBeenCalled();
    expect(screen.queryByText(/private locked metadata/i)).not.toBeInTheDocument();
  });

  it('reruns preflight under the lock and stops after the first fixed row failure', async () => {
    const secondRow = { ...validRow, id: `${approvedFileSha256}:3`, rowNumber: 3 };
    mockParseSantaClotildeWorkbook.mockResolvedValue({ ...manifest, rows: [validRow, secondRow] });
    mockCreatePatientFromImportRow.mockImplementation(async (_row, _types, _location, options) => {
      await options.assertBeforeWrite();
      throw new Error('backend exposed a DNI and internal URL');
    });

    const { container } = renderBulkPatientImport();
    uploadFile(container);
    fireEvent.click(await screen.findByRole('button', { name: /run safety preflight/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /create patients/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /create patients/i }));
    const confirmDialog = await screen.findByRole('dialog', { name: /create patients/i });
    fireEvent.click(confirmDialog.querySelector('button.cds--btn--danger') as HTMLButtonElement);

    await waitFor(() => expect(mockCreatePatientFromImportRow).toHaveBeenCalledOnce());
    expect(mockWithLock).toHaveBeenCalledOnce();
    expect(mockFetchFreshIdentifierTypes).toHaveBeenCalledTimes(2);
    expect(mockPreflightRows).toHaveBeenCalledTimes(2);
    expect(mockAssertFreshContext).toHaveBeenCalledTimes(4);
    expect(await screen.findByText('Import stopped. Reconcile this row before any retry.')).toBeInTheDocument();
    expect(screen.getByText('Not attempted after an earlier failure.')).toBeInTheDocument();
    expectSummaryValue('Skipped', 1);
    expect(screen.queryByText(/backend exposed/i)).not.toBeInTheDocument();
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ message: bulkPatientImportSafetyErrorMessage }),
      'Bulk patient import stopped at a safety boundary',
    );
  });

  it('reconciles rows found by the locked preflight without creating them', async () => {
    mockParseSantaClotildeWorkbook.mockResolvedValue(manifest);
    mockPreflightRows
      .mockResolvedValueOnce({ reconciledRowIds: new Set() })
      .mockResolvedValueOnce({ reconciledRowIds: new Set([validRow.id]) });

    const { container } = renderBulkPatientImport();
    uploadFile(container);
    fireEvent.click(await screen.findByRole('button', { name: /run safety preflight/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /create patients/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /create patients/i }));
    const confirmDialog = await screen.findByRole('dialog', { name: /create patients/i });
    fireEvent.click(confirmDialog.querySelector('button.cds--btn--danger') as HTMLButtonElement);

    expect(await screen.findByText('Existing patient safely reconciled.')).toBeInTheDocument();
    expect(screen.getByText('reconciled')).toBeInTheDocument();
    expectSummaryValue('Created', 0);
    expectSummaryValue('Reconciled', 1);
    expect(mockPreflightRows).toHaveBeenCalledTimes(2);
    expect(mockCreatePatientFromImportRow).not.toHaveBeenCalled();
  });

  it('preserves the created result when a later preflight reconciles the same patient', async () => {
    mockParseSantaClotildeWorkbook.mockResolvedValue(manifest);
    mockPreflightRows
      .mockResolvedValueOnce({ reconciledRowIds: new Set() })
      .mockResolvedValueOnce({ reconciledRowIds: new Set() })
      .mockResolvedValueOnce({ reconciledRowIds: new Set([validRow.id]) });

    const { container } = renderBulkPatientImport();
    uploadFile(container);
    fireEvent.click(await screen.findByRole('button', { name: /run safety preflight/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /create patients/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /create patients/i }));
    const confirmDialog = await screen.findByRole('dialog', { name: /create patients/i });
    fireEvent.click(confirmDialog.querySelector('button.cds--btn--danger') as HTMLButtonElement);

    expect(await screen.findByText('Patient created and reconciled.')).toBeInTheDocument();
    expectSummaryValue('Created', 1);
    expectSummaryValue('Reconciled', 0);

    fireEvent.click(screen.getByRole('button', { name: /run safety preflight/i }));
    await waitFor(() => expect(mockPreflightRows).toHaveBeenCalledTimes(3));
    expectSummaryValue('Created', 1);
    expectSummaryValue('Reconciled', 0);
  });

  it('reports a conservatively reconciled row separately when creation could not be confirmed directly', async () => {
    mockParseSantaClotildeWorkbook.mockResolvedValue(manifest);
    mockCreatePatientFromImportRow.mockResolvedValue({
      patientUuid: deterministicPatientUuid,
      outcome: 'reconciled',
    });

    const { container } = renderBulkPatientImport();
    uploadFile(container);
    fireEvent.click(await screen.findByRole('button', { name: /run safety preflight/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /create patients/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /create patients/i }));
    const confirmDialog = await screen.findByRole('dialog', { name: /create patients/i });
    fireEvent.click(confirmDialog.querySelector('button.cds--btn--danger') as HTMLButtonElement);

    expect(await screen.findByText('Existing patient safely reconciled.')).toBeInTheDocument();
    expectSummaryValue('Created', 0);
    expectSummaryValue('Reconciled', 1);
  });

  it('aborts the active row request and suppresses stale updates when unmounted', async () => {
    let rowSignal: AbortSignal | undefined;
    mockParseSantaClotildeWorkbook.mockResolvedValue(manifest);
    mockCreatePatientFromImportRow.mockImplementation(
      (_row, _identifierTypes, _locationUuid, options) =>
        new Promise((_resolve, reject) => {
          rowSignal = options.signal;
          options.signal?.addEventListener('abort', () => reject(new Error('private row failure')), { once: true });
        }),
    );

    const rendered = renderBulkPatientImport();
    uploadFile(rendered.container);
    fireEvent.click(await screen.findByRole('button', { name: /run safety preflight/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /create patients/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /create patients/i }));
    const confirmDialog = await screen.findByRole('dialog', { name: /create patients/i });
    fireEvent.click(confirmDialog.querySelector('button.cds--btn--danger') as HTMLButtonElement);
    await waitFor(() => expect(mockCreatePatientFromImportRow).toHaveBeenCalledOnce());

    const cancelNavigation = vi.fn();
    const dispatchNavigation = () =>
      globalThis.dispatchEvent(
        new CustomEvent('single-spa:before-routing-event', {
          detail: { navigationIsCanceled: false, cancelNavigation },
        }),
      );
    act(dispatchNavigation);
    expect(cancelNavigation).toHaveBeenCalledOnce();

    act(() => rendered.unmount());

    expect(rowSignal?.aborted).toBe(true);
    act(dispatchNavigation);
    expect(cancelNavigation).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(mockLogError).not.toHaveBeenCalledWith(
        expect.anything(),
        'Bulk patient import stopped at a safety boundary',
      ),
    );
  });
});

function renderBulkPatientImport() {
  return render(renderBulkPatientImportTree(resources));
}

function renderBulkPatientImportTree(resourceValue: Resources) {
  return (
    <ResourcesContext.Provider value={resourceValue}>
      <BulkPatientImport isOffline={false} />
    </ResourcesContext.Provider>
  );
}

function uploadFile(container: HTMLElement, file = new File(['synthetic'], 'approved.xlsx')) {
  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(fileInput, { target: { files: [file] } });
}

function expectSummaryValue(label: string, value: number) {
  const summary = screen.getByText('Rows').closest('section');
  if (!summary) {
    throw new Error('Bulk patient import summary is missing.');
  }
  expect(within(summary).getByText(label).parentElement).toHaveTextContent(`${label}${value}`);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}
