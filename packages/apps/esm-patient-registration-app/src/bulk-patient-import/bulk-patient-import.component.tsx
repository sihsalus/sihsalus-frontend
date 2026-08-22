import {
  Button,
  ButtonSet,
  Column,
  FileUploaderButton,
  Grid,
  InlineLoading,
  InlineNotification,
  Modal,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tile,
} from '@carbon/react';
import { Download } from '@carbon/react/icons';
import { logError, showSnackbar, useConfig } from '@openmrs/esm-framework';
import type { TFunction } from 'i18next';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isCanonicalUtcInstant, type RegistrationConfig } from '../config-schema';
import { moduleName } from '../constants';
import { fetchFreshPatientIdentifierTypesWithSources, ResourcesContext } from '../offline.resources';
import styles from './bulk-patient-import.scss';
import type { ParsedPatientImportRow, PatientImportManifest } from './bulk-patient-import.types';
import {
  bulkPatientImportRowErrorMessage,
  calculateFileSha256,
  createPatientFromImportRow,
  downloadImportReport,
  downloadSantaClotildeTemplate,
  getImportLimits,
  parseSantaClotildeWorkbook,
  preflightBulkPatientImportRows,
  summarizeImportRows,
} from './bulk-patient-import.utils';
import {
  assertFreshBulkPatientImportContext,
  bulkPatientImportSafetyErrorMessage,
  withBulkPatientImportLock,
} from './bulk-patient-import-runner';

interface BulkPatientImportProps {
  isOffline: boolean;
}

const previewLimit = 100;
const fixedImportLogMessage = 'Bulk patient import stopped at a safety boundary';
const fixedDownloadErrorMessage = 'The requested bulk patient import file could not be downloaded.';

const validationMessageTranslations: Record<string, readonly [key: string, fallback: string]> = {
  'ORDEN is empty.': ['bulkPatientImportValidationOrderEmpty', 'ORDEN is empty.'],
  'ORDEN exceeds the maximum length of 100 characters.': [
    'bulkPatientImportValidationOrderTooLong',
    'ORDEN exceeds the maximum length of 100 characters.',
  ],
  'DNI must have exactly 8 digits.': ['bulkPatientImportValidationDniLength', 'DNI must have exactly 8 digits.'],
  'DNI 00000000 is reserved for the synthetic template and cannot be imported.': [
    'bulkPatientImportValidationSyntheticDni',
    'DNI 00000000 is reserved for the synthetic template and cannot be imported.',
  ],
  'SEXO must be M, F, O, or D.': ['bulkPatientImportValidationGender', 'SEXO must be M, F, O, or D.'],
  'F.N. must use DD/MM/YYYY format and be a valid date.': [
    'bulkPatientImportValidationBirthdate',
    'F.N. must use DD/MM/YYYY format and be a valid date.',
  ],
  'A.PATERNO is required.': ['bulkPatientImportValidationPaternalNameRequired', 'A.PATERNO is required.'],
  'A.MATERNO is required.': ['bulkPatientImportValidationMaternalNameRequired', 'A.MATERNO is required.'],
  'NOMBRES is required.': ['bulkPatientImportValidationGivenNameRequired', 'NOMBRES is required.'],
  'Los pacientes menores de edad deben registrarse manualmente junto con su responsable.': [
    'bulkPatientImportValidationMinor',
    'Patients younger than 18 must be registered manually with their responsible adult.',
  ],
  'DOMICILIO is empty.': ['bulkPatientImportValidationAddressEmpty', 'DOMICILIO is empty.'],
  'DOMICILIO exceeds the maximum length of 255 characters.': [
    'bulkPatientImportValidationAddressTooLong',
    'DOMICILIO exceeds the maximum length of 255 characters.',
  ],
  'PARENTESCO is not saved; retain it only in the separately controlled approved workbook.': [
    'bulkPatientImportValidationRelationshipNotSaved',
    'PARENTESCO is not saved; retain it only in the separately controlled approved workbook.',
  ],
  'PARENTESCO exceeds the maximum length of 100 characters.': [
    'bulkPatientImportValidationRelationshipTooLong',
    'PARENTESCO exceeds the maximum length of 100 characters.',
  ],
  'Duplicate DNI within the file.': ['bulkPatientImportValidationDuplicateDni', 'Duplicate DNI within the file.'],
  'Duplicate patient within the file: same name, birthdate, and sex.': [
    'bulkPatientImportValidationDuplicateDemographics',
    'Duplicate patient within the file: same name, birthdate, and sex.',
  ],
};

type ImportPhase = 'idle' | 'revalidating' | 'creating';
type DownloadKind = 'template' | 'report';
type LauncherButtonRef = React.RefCallback<HTMLButtonElement> & { current: HTMLButtonElement | null };

const BulkPatientImport: React.FC<BulkPatientImportProps> = ({ isOffline }) => {
  const { t } = useTranslation(moduleName);
  const createPatientsButtonRef = useMemo(createLauncherButtonRef, []);
  const activeDownloadRef = useRef<DownloadKind | null>(null);
  const operationTokenRef = useRef(0);
  const importAbortControllerRef = useRef<AbortController | null>(null);
  const { bulkPatientImport: importConfig } = useConfig<RegistrationConfig>();
  const { currentSession } = useContext(ResourcesContext);
  const approvalCheckTime = useApprovalCheckTime(importConfig.approvalExpiresAt);
  const userUuid = currentSession?.user?.uuid;
  const locationUuid = currentSession?.sessionLocation?.uuid;
  const [manifest, setManifest] = useState<PatientImportManifest | null>(null);
  const [hasParseError, setHasParseError] = useState(false);
  const [hasApprovalError, setHasApprovalError] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isPreflighting, setIsPreflighting] = useState(false);
  const [preflightFingerprint, setPreflightFingerprint] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle');
  const [activeDownload, setActiveDownload] = useState<DownloadKind | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [currentImportRow, setCurrentImportRow] = useState(0);
  const [currentImportTotal, setCurrentImportTotal] = useState(0);
  const limits = getImportLimits(importConfig.maxRows);
  const rows = manifest?.rows ?? [];
  const summary = useMemo(() => summarizeImportRows(rows), [rows]);
  const rowsWithErrors = rows.filter((row) => row.errors.length > 0);
  const pendingRows = rows.filter(
    (row) => !row.errors.length && row.status !== 'created' && row.status !== 'reconciled',
  );
  const isBusy = isParsing || isPreflighting || isImporting || activeDownload !== null;
  const domicilioTarget =
    importConfig.domicilioTarget === 'address4' || importConfig.domicilioTarget === 'cityVillage'
      ? importConfig.domicilioTarget
      : null;
  const expectedFingerprint =
    manifest && userUuid && locationUuid ? getPreflightFingerprint(manifest, userUuid, locationUuid, importConfig) : '';
  const approvalContextFingerprint = getApprovalContextFingerprint(
    importConfig,
    currentSession?.authenticated,
    userUuid,
    locationUuid,
  );
  const previousApprovalContextFingerprintRef = useRef(approvalContextFingerprint);
  const initialContextApproved =
    currentSession?.authenticated === true &&
    importConfig.enabled &&
    Boolean(domicilioTarget) &&
    isCanonicalUtcInstant(importConfig.approvalExpiresAt) &&
    Date.parse(importConfig.approvalExpiresAt) > approvalCheckTime &&
    importConfig.approvedOrigin === globalThis.location.origin &&
    importConfig.approvedUserUuid === userUuid &&
    importConfig.approvedLocationUuid === locationUuid;
  const canPreflight =
    initialContextApproved && !isOffline && !isBusy && Boolean(manifest) && !hasApprovalError && !summary.errors;
  const canImport =
    canPreflight && preflightFingerprint === expectedFingerprint && Boolean(pendingRows.length) && !isPreflighting;

  useImportNavigationGuard(isImporting, t('bulkPatientImportNavigationBlocked', 'The import is still running.'));

  useEffect(
    () => () => {
      operationTokenRef.current += 1;
      importAbortControllerRef.current?.abort();
      importAbortControllerRef.current = null;
    },
    [],
  );

  useEffect(() => {
    const approvalContextChanged = previousApprovalContextFingerprintRef.current !== approvalContextFingerprint;
    previousApprovalContextFingerprintRef.current = approvalContextFingerprint;
    if (!approvalContextChanged && initialContextApproved) {
      return;
    }

    operationTokenRef.current += 1;
    importAbortControllerRef.current?.abort();
    importAbortControllerRef.current = null;
    setManifest(null);
    setHasParseError(false);
    setHasApprovalError(false);
    setIsParsing(false);
    setIsPreflighting(false);
    setPreflightFingerprint('');
    setIsImporting(false);
    setImportPhase('idle');
    setIsConfirmOpen(false);
    setCurrentImportRow(0);
    setCurrentImportTotal(0);
  }, [approvalContextFingerprint, initialContextApproved]);

  const updateManifestRows = (fileSha256: string, update: (row: ParsedPatientImportRow) => ParsedPatientImportRow) => {
    setManifest((current) =>
      current?.fileSha256 === fileSha256 ? { ...current, rows: current.rows.map(update) } : current,
    );
  };

  const updateRow = (fileSha256: string, rowId: string, updates: Partial<ParsedPatientImportRow>) => {
    updateManifestRows(fileSha256, (row) => (row.id === rowId ? { ...row, ...updates } : row));
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || isBusy) {
      return;
    }

    const operationToken = ++operationTokenRef.current;
    setIsParsing(true);
    setManifest(null);
    setHasParseError(false);
    setHasApprovalError(false);
    setPreflightFingerprint('');
    setCurrentImportRow(0);

    try {
      if (!file.name.toLowerCase().endsWith('.xlsx') || !file.size || file.size > limits.maxFileSizeBytes) {
        throw new Error(bulkPatientImportSafetyErrorMessage);
      }
      const fileSha256 = await calculateFileSha256(file);
      if (operationToken !== operationTokenRef.current) {
        return;
      }
      if (fileSha256 !== importConfig.approvedFileSha256) {
        setHasApprovalError(true);
        return;
      }
      const parsedManifest = await parseSantaClotildeWorkbook(file, importConfig.maxRows);
      if (operationToken !== operationTokenRef.current || parsedManifest.fileSha256 !== fileSha256) {
        if (operationToken === operationTokenRef.current) {
          throw new Error(bulkPatientImportSafetyErrorMessage);
        }
        return;
      }
      setManifest(parsedManifest);
    } catch {
      if (operationToken === operationTokenRef.current) {
        logFixedImportFailure('Bulk patient import file parsing failed');
        setHasParseError(true);
      }
    } finally {
      if (operationToken === operationTokenRef.current) {
        setIsParsing(false);
      }
      event.target.value = '';
    }
  };

  const downloadTemplate = async () => {
    if (isBusy || activeDownloadRef.current) {
      return;
    }

    activeDownloadRef.current = 'template';
    setActiveDownload('template');
    try {
      await downloadSantaClotildeTemplate(importConfig.maxRows);
    } catch {
      logFixedDownloadFailure('Bulk patient import template download failed');
      showFixedDownloadFailureSnackbar(t, 'bulkPatientImportTemplateDownloadFailedTitle', 'Template download failed');
    } finally {
      activeDownloadRef.current = null;
      setActiveDownload(null);
    }
  };

  const downloadReport = async () => {
    if (isBusy || activeDownloadRef.current) {
      return;
    }

    activeDownloadRef.current = 'report';
    setActiveDownload('report');
    try {
      await downloadImportReport(rows);
    } catch {
      logFixedDownloadFailure('Bulk patient import protected report download failed');
      showFixedDownloadFailureSnackbar(
        t,
        'bulkPatientImportReportDownloadFailedTitle',
        'Protected report download failed',
      );
    } finally {
      activeDownloadRef.current = null;
      setActiveDownload(null);
    }
  };

  const runPreflight = async () => {
    if (!manifest || !userUuid || !locationUuid || !domicilioTarget || !canPreflight) {
      return;
    }

    const operationToken = ++operationTokenRef.current;
    const fileSha256 = manifest.fileSha256;
    setIsPreflighting(true);
    setPreflightFingerprint('');

    try {
      await assertFreshBulkPatientImportContext({ config: importConfig, fileSha256, userUuid, locationUuid });
      const freshIdentifierTypes = await fetchFreshPatientIdentifierTypesWithSources();
      const result = await preflightBulkPatientImportRows(manifest.rows, freshIdentifierTypes, locationUuid, {
        domicilioTarget,
      });
      if (operationToken !== operationTokenRef.current) {
        return;
      }
      updateManifestRows(fileSha256, (row) => {
        if (result.reconciledRowIds.has(row.id)) {
          return preserveCreatedOrMarkReconciled(
            row,
            t('bulkPatientImportReconciledMessage', 'Existing patient safely reconciled.'),
          );
        }
        return { ...row, status: row.warnings.length ? 'warning' : 'valid', importMessage: '' };
      });
      setPreflightFingerprint(getPreflightFingerprint(manifest, userUuid, locationUuid, importConfig));
      showSnackbar({
        title: t('bulkPatientImportPreflightPassedTitle', 'Safety preflight passed'),
        subtitle: t(
          'bulkPatientImportPreflightPassedSubtitle',
          'No write was performed. Review the rows before starting the import.',
        ),
        kind: 'success',
      });
    } catch {
      if (operationToken === operationTokenRef.current) {
        logFixedImportFailure('Bulk patient import preflight failed');
        showFixedFailureSnackbar(
          t,
          'bulkPatientImportPreflightFailedTitle',
          'Safety preflight failed',
          'bulkPatientImportPreflightFailedSubtitle',
          'No write was performed. Verify your connection, session, and approved configuration before retrying.',
        );
      }
    } finally {
      if (operationToken === operationTokenRef.current) {
        setIsPreflighting(false);
      }
    }
  };

  const importRows = async () => {
    setIsConfirmOpen(false);
    if (!manifest || !userUuid || !locationUuid || !domicilioTarget || !canImport) {
      return;
    }

    const operationToken = ++operationTokenRef.current;
    const abortController = new AbortController();
    importAbortControllerRef.current = abortController;
    const fileSha256 = manifest.fileSha256;
    const approvedRows = manifest.rows.map((row) => ({ ...row }));
    setIsImporting(true);
    setImportPhase('revalidating');
    setCurrentImportRow(0);
    setCurrentImportTotal(0);
    let rowOperationStarted = false;

    try {
      await withBulkPatientImportLock(async () => {
        await assertFreshBulkPatientImportContext(
          { config: importConfig, fileSha256, userUuid, locationUuid },
          abortController.signal,
        );
        const lockedIdentifierTypes = await fetchFreshPatientIdentifierTypesWithSources(abortController.signal);
        const secondPreflight = await preflightBulkPatientImportRows(
          approvedRows,
          lockedIdentifierTypes,
          locationUuid,
          {
            domicilioTarget,
            signal: abortController.signal,
          },
        );
        updateManifestRows(fileSha256, (row) =>
          secondPreflight.reconciledRowIds.has(row.id)
            ? preserveCreatedOrMarkReconciled(
                row,
                t('bulkPatientImportReconciledMessage', 'Existing patient safely reconciled.'),
              )
            : row,
        );
        const rowsToCreate = approvedRows.filter((row) => !secondPreflight.reconciledRowIds.has(row.id));
        setCurrentImportTotal(rowsToCreate.length);
        if (rowsToCreate.length) {
          setImportPhase('creating');
        }

        for (let index = 0; index < rowsToCreate.length; index++) {
          if (operationToken !== operationTokenRef.current || abortController.signal.aborted) {
            throw new Error(bulkPatientImportRowErrorMessage);
          }
          const row = rowsToCreate[index];
          rowOperationStarted = true;
          setCurrentImportRow(index + 1);
          updateRow(fileSha256, row.id, { status: 'creating', importMessage: '' });

          try {
            await assertFreshBulkPatientImportContext(
              { config: importConfig, fileSha256, userUuid, locationUuid },
              abortController.signal,
            );
            const result = await createPatientFromImportRow(row, lockedIdentifierTypes, locationUuid, {
              domicilioTarget,
              signal: abortController.signal,
              assertBeforeWrite: () =>
                assertFreshBulkPatientImportContext(
                  { config: importConfig, fileSha256, userUuid, locationUuid },
                  abortController.signal,
                ),
            });
            if (operationToken !== operationTokenRef.current || abortController.signal.aborted) {
              throw new Error(bulkPatientImportRowErrorMessage);
            }
            updateRow(fileSha256, row.id, {
              status: result.outcome,
              patientUuid: result.patientUuid,
              importMessage:
                result.outcome === 'created'
                  ? t('bulkPatientImportCreatedMessage', 'Patient created and reconciled.')
                  : t('bulkPatientImportReconciledMessage', 'Existing patient safely reconciled.'),
            });
          } catch {
            if (operationToken === operationTokenRef.current) {
              updateRow(fileSha256, row.id, {
                status: 'failed',
                importMessage: t(
                  'bulkPatientImportStoppedMessage',
                  'Import stopped. Reconcile this row before any retry.',
                ),
              });
              for (const skippedRow of rowsToCreate.slice(index + 1)) {
                updateRow(fileSha256, skippedRow.id, {
                  status: 'skipped',
                  importMessage: t('bulkPatientImportSkippedMessage', 'Not attempted after an earlier failure.'),
                });
              }
            }
            throw new Error(bulkPatientImportRowErrorMessage);
          }
        }
      });

      if (operationToken === operationTokenRef.current) {
        showSnackbar({
          title: t('bulkPatientImportFinishedTitle', 'Import completed and reconciled'),
          subtitle: t('bulkPatientImportFinishedSubtitle', 'Download and protect the reconciliation report.'),
          kind: 'success',
        });
      }
    } catch {
      if (operationToken === operationTokenRef.current) {
        logFixedImportFailure(fixedImportLogMessage);
        if (rowOperationStarted) {
          showFixedFailureSnackbar(t, 'bulkPatientImportStoppedTitle', 'Import stopped safely');
        } else {
          showFixedFailureSnackbar(
            t,
            'bulkPatientImportPreflightFailedTitle',
            'Safety preflight failed',
            'bulkPatientImportPreflightFailedSubtitle',
            'No write was performed. Verify your connection, session, and approved configuration before retrying.',
          );
        }
      }
    } finally {
      if (operationToken === operationTokenRef.current) {
        setIsImporting(false);
        setImportPhase('idle');
      }
      if (importAbortControllerRef.current === abortController) {
        importAbortControllerRef.current = null;
      }
    }
  };

  return (
    <Grid className={styles.page}>
      <Column sm={4} md={8} lg={16}>
        <Stack gap={6}>
          <header className={styles.header}>
            <div>
              <h1>{t('bulkPatientImportTitle', 'Import patients')}</h1>
              <p>
                {t(
                  'bulkPatientImportSubtitle',
                  'One-time import of an approved Excel workbook that stops on any unsafe result.',
                )}
              </p>
            </div>
          </header>

          {!importConfig.enabled ? (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t('bulkPatientImportDisabledTitle', 'Bulk import is disabled')}
              subtitle={t(
                'bulkPatientImportDisabledSubtitle',
                'An administrator must approve one exact file, application version, operator, location, origin, and address mapping.',
              )}
            />
          ) : !initialContextApproved ? (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t('bulkPatientImportContextBlockedTitle', 'This import context is not approved')}
              subtitle={t(
                'bulkPatientImportContextBlockedSubtitle',
                'Use the exact approved origin, operator, and session location.',
              )}
            />
          ) : null}

          {isOffline ? (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t('bulkPatientImportOfflineTitle', 'Import is unavailable while offline')}
              subtitle={t('bulkPatientImportOfflineSubtitle', 'Connect before running clinical safety checks.')}
            />
          ) : null}

          {initialContextApproved ? (
            <section className={styles.toolbar} aria-label={t('bulkPatientImportActions', 'Import actions')}>
              <ButtonSet>
                <Button kind="secondary" renderIcon={Download} disabled={isBusy} onClick={downloadTemplate}>
                  {activeDownload === 'template'
                    ? t('bulkPatientImportPreparingTemplate', 'Preparing template...')
                    : t('bulkPatientImportDownloadTemplate', 'Download template')}
                </Button>
                <FileUploaderButton
                  accept={['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']}
                  buttonKind="primary"
                  disabled={isBusy || isOffline}
                  disableLabelChanges
                  labelText={t('bulkPatientImportUploadTemplate', 'Upload Excel')}
                  multiple={false}
                  onChange={handleFileChange}
                />
              </ButtonSet>
              <p>
                {t('bulkPatientImportLimits', 'Limits: {{rows}} rows and {{mb}} MB per file.', {
                  rows: limits.maxRows,
                  mb: Math.round(limits.maxFileSizeBytes / 1024 / 1024),
                })}
              </p>
            </section>
          ) : null}

          {isParsing ? <InlineLoading description={t('bulkPatientImportParsing', 'Reading file...')} /> : null}
          {isPreflighting ? (
            <InlineLoading description={t('bulkPatientImportPreflighting', 'Running read-only safety checks...')} />
          ) : null}

          {hasParseError ? (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              role="alert"
              title={t('bulkPatientImportParseErrorTitle', 'Could not read the file')}
              subtitle={t('bulkPatientImportFixedError', bulkPatientImportSafetyErrorMessage)}
            />
          ) : null}

          {hasApprovalError ? (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              role="alert"
              title={t('bulkPatientImportFileNotApprovedTitle', 'This file is not approved')}
              subtitle={t(
                'bulkPatientImportFileNotApprovedSubtitle',
                'Its SHA-256 does not match the one-time approval. No server request was made.',
              )}
            />
          ) : null}

          {initialContextApproved && manifest ? (
            <>
              <InlineNotification
                kind="info"
                lowContrast
                title={t('bulkPatientImportManifestTitle', 'Approved manifest')}
                subtitle={t('bulkPatientImportManifestSubtitle', 'SHA-256: {{hash}} · {{count}} rows', {
                  hash: manifest.fileSha256,
                  count: rows.length,
                })}
              />

              <section
                className={styles.summary}
                aria-label={t('bulkPatientImportSummaryLabel', 'Patient import summary')}
              >
                <SummaryTile label={t('bulkPatientImportTotalRows', 'Rows')} value={summary.total} />
                <SummaryTile label={t('bulkPatientImportValidRows', 'Valid')} value={summary.valid} />
                <SummaryTile label={t('bulkPatientImportWarningRows', 'Warnings')} value={summary.warnings} />
                <SummaryTile label={t('bulkPatientImportErrorRows', 'Errors')} value={summary.errors} />
                <SummaryTile label={t('bulkPatientImportCreatedRows', 'Created')} value={summary.created} />
                <SummaryTile label={t('bulkPatientImportReconciledRows', 'Reconciled')} value={summary.reconciled} />
                <SummaryTile label={t('bulkPatientImportFailedRows', 'Failed')} value={summary.failed} />
                <SummaryTile label={t('bulkPatientImportSkippedRows', 'Skipped')} value={summary.skipped} />
              </section>

              {rowsWithErrors.length ? (
                <InlineNotification
                  kind="error"
                  lowContrast
                  hideCloseButton
                  role="alert"
                  title={t('bulkPatientImportRowsBlockedTitle', 'Some rows have errors')}
                  subtitle={t('bulkPatientImportRowsBlockedSubtitle', 'Correct and reapprove the exact workbook.')}
                />
              ) : null}

              <section
                className={styles.actions}
                aria-label={t('bulkPatientImportPatientActionsLabel', 'Patient import controls')}
              >
                <ButtonSet>
                  <Button kind="secondary" disabled={!canPreflight} onClick={runPreflight}>
                    {t('bulkPatientImportRunPreflight', 'Run safety preflight')}
                  </Button>
                  <Button
                    ref={createPatientsButtonRef}
                    kind="danger"
                    disabled={!canImport}
                    onClick={() => setIsConfirmOpen(true)}
                  >
                    {t('bulkPatientImportCreatePatients', 'Create patients')}
                  </Button>
                  <Button kind="ghost" disabled={isBusy} onClick={downloadReport}>
                    {activeDownload === 'report'
                      ? t('bulkPatientImportPreparingReport', 'Preparing report...')
                      : t('bulkPatientImportDownloadReport', 'Download protected report')}
                  </Button>
                </ButtonSet>
                {isImporting && importPhase === 'revalidating' ? (
                  <InlineLoading
                    description={t(
                      'bulkPatientImportRevalidating',
                      'Re-running safety checks before creating patients...',
                    )}
                  />
                ) : null}
                {isImporting && importPhase === 'creating' && currentImportRow > 0 && currentImportTotal > 0 ? (
                  <InlineLoading
                    description={t('bulkPatientImportProgress', 'Creating {{current}} of {{total}} patients...', {
                      current: currentImportRow,
                      total: currentImportTotal,
                    })}
                  />
                ) : null}
              </section>

              <InlineNotification
                kind="warning"
                lowContrast
                hideCloseButton
                title={t('bulkPatientImportReportPrivacyTitle', 'The report contains clinical identifiers')}
                subtitle={t(
                  'bulkPatientImportReportPrivacySubtitle',
                  'Keep it only in the approved encrypted location and never attach it to a public ticket.',
                )}
              />

              {rows.length > previewLimit ? (
                <p className={styles.previewLimit}>
                  {t(
                    'bulkPatientImportPreviewLimit',
                    'Showing the first {{shown}} of {{total}} rows. The summary and protected report include all rows.',
                    { shown: previewLimit, total: rows.length },
                  )}
                </p>
              ) : null}

              <PatientImportPreview rows={rows.slice(0, previewLimit)} t={t} />
            </>
          ) : null}
        </Stack>
      </Column>

      {initialContextApproved ? (
        <Modal
          open={isConfirmOpen}
          closeButtonLabel={t('bulkPatientImportCloseDialog', 'Close')}
          launcherButtonRef={createPatientsButtonRef}
          modalHeading={t('bulkPatientImportConfirmTitle', 'Create patients')}
          primaryButtonText={t('bulkPatientImportConfirmPrimary', 'Create')}
          primaryButtonDisabled={!canImport || isBusy}
          secondaryButtonText={t('bulkPatientImportConfirmSecondary', 'Cancel')}
          danger
          onRequestClose={() => setIsConfirmOpen(false)}
          onSecondarySubmit={() => setIsConfirmOpen(false)}
          onRequestSubmit={importRows}
        >
          <p>
            {t(
              'bulkPatientImportConfirmBody',
              'The live safety check will run again under an exclusive lock before creating up to {{count}} patients. The batch stops on the first uncertain result and cannot be rolled back automatically.',
              { count: pendingRows.length },
            )}
          </p>
          <p className={styles.modalHash}>
            <strong>{t('bulkPatientImportConfirmHashLabel', 'Approved file SHA-256')}:</strong>{' '}
            <code>{manifest?.fileSha256}</code>
          </p>
        </Modal>
      ) : null}
    </Grid>
  );
};

function createLauncherButtonRef(): LauncherButtonRef {
  const launcherButtonRef = ((node: HTMLButtonElement | null) => {
    launcherButtonRef.current = node;
  }) as LauncherButtonRef;
  launcherButtonRef.current = null;
  return launcherButtonRef;
}

function useApprovalCheckTime(approvalExpiresAt: string) {
  const [approvalCheckTime, setApprovalCheckTime] = useState(() => Date.now());

  useEffect(() => {
    if (!isCanonicalUtcInstant(approvalExpiresAt)) {
      setApprovalCheckTime(Date.now());
      return;
    }

    let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
    const scheduleExpirationCheck = () => {
      const remainingMilliseconds = Date.parse(approvalExpiresAt) - Date.now();
      if (remainingMilliseconds <= 0) {
        setApprovalCheckTime(Date.now());
        return;
      }
      timeout = globalThis.setTimeout(scheduleExpirationCheck, Math.min(remainingMilliseconds + 1, 2_147_483_647));
    };
    scheduleExpirationCheck();
    return () => {
      if (timeout !== undefined) {
        globalThis.clearTimeout(timeout);
      }
    };
  }, [approvalExpiresAt]);

  return approvalCheckTime;
}

function useImportNavigationGuard(when: boolean, message: string) {
  useEffect(() => {
    if (!when) {
      return;
    }

    const cancelUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };
    const cancelNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{ navigationIsCanceled?: boolean; cancelNavigation?: () => void }>).detail;
      if (!detail?.navigationIsCanceled) {
        detail?.cancelNavigation?.();
      }
    };

    globalThis.addEventListener('beforeunload', cancelUnload);
    globalThis.addEventListener('single-spa:before-routing-event', cancelNavigation);
    return () => {
      globalThis.removeEventListener('beforeunload', cancelUnload);
      globalThis.removeEventListener('single-spa:before-routing-event', cancelNavigation);
    };
  }, [message, when]);
}

function getApprovalContextFingerprint(
  config: RegistrationConfig['bulkPatientImport'],
  authenticated: boolean | undefined,
  userUuid: string | undefined,
  locationUuid: string | undefined,
) {
  return JSON.stringify([
    authenticated,
    userUuid,
    locationUuid,
    globalThis.location.origin,
    config.enabled,
    config.approvedFileSha256,
    config.approvedBuildSha,
    config.approvedOrigin,
    config.approvalExpiresAt,
    config.approvedUserUuid,
    config.approvedLocationUuid,
    config.domicilioTarget,
  ]);
}

function getPreflightFingerprint(
  manifest: PatientImportManifest,
  userUuid: string,
  locationUuid: string,
  config: RegistrationConfig['bulkPatientImport'],
) {
  return [
    manifest.fileSha256,
    userUuid,
    locationUuid,
    config.approvedFileSha256,
    config.approvedBuildSha,
    config.approvedOrigin,
    config.approvalExpiresAt,
    config.approvedUserUuid,
    config.approvedLocationUuid,
    config.domicilioTarget,
  ].join(':');
}

function logFixedImportFailure(context: string) {
  logError(new Error(bulkPatientImportSafetyErrorMessage), context);
}

function showFixedFailureSnackbar(
  t: TFunction,
  key: string,
  title: string,
  subtitleKey = 'bulkPatientImportStoppedSubtitle',
  subtitle = 'No further rows were attempted. Reconcile the current row before retrying.',
) {
  showSnackbar({
    title: t(key, title),
    subtitle: t(subtitleKey, subtitle),
    kind: 'error',
  });
}

function logFixedDownloadFailure(context: string) {
  logError(new Error(fixedDownloadErrorMessage), context);
}

function showFixedDownloadFailureSnackbar(t: TFunction, titleKey: string, title: string) {
  showSnackbar({
    title: t(titleKey, title),
    subtitle: t(
      'bulkPatientImportDownloadFailedSubtitle',
      'No file was downloaded. Try again; if the problem continues, contact your system administrator.',
    ),
    kind: 'error',
  });
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <Tile className={styles.summaryTile}>
      <span>{label}</span>
      <strong>{value}</strong>
    </Tile>
  );
}

function preserveCreatedOrMarkReconciled(row: ParsedPatientImportRow, reconciledMessage: string) {
  return row.status === 'created'
    ? row
    : {
        ...row,
        status: 'reconciled' as const,
        importMessage: reconciledMessage,
      };
}

function PatientImportPreview({ rows, t }: { rows: Array<ParsedPatientImportRow>; t: TFunction }) {
  return (
    <TableContainer className={styles.tableWrapper}>
      <Table
        {...{
          'aria-label': t('bulkPatientImportPreviewTableLabel', 'Patient import preview'),
        }}
        className={styles.table}
        tabIndex={0}
      >
        <TableHead>
          <TableRow>
            <TableHeader>{t('bulkPatientImportRowHeader', 'Row')}</TableHeader>
            <TableHeader>{t('bulkPatientImportStatusHeader', 'Status')}</TableHeader>
            <TableHeader>DNI</TableHeader>
            <TableHeader>{t('bulkPatientImportPatientHeader', 'Patient')}</TableHeader>
            <TableHeader>{t('bulkPatientImportBirthdateHeader', 'Birthdate')}</TableHeader>
            <TableHeader>{t('bulkPatientImportSexHeader', 'Sex')}</TableHeader>
            <TableHeader>{t('bulkPatientImportAddressHeader', 'Address')}</TableHeader>
            <TableHeader>{t('bulkPatientImportMessagesHeader', 'Messages')}</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.rowNumber}</TableCell>
              <TableCell>
                <StatusTag status={row.status} t={t} />
              </TableCell>
              <TableCell>{row.normalized.dni}</TableCell>
              <TableCell>
                {[
                  row.normalized.givenName,
                  row.normalized.middleName,
                  row.normalized.familyName,
                  row.normalized.familyName2,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </TableCell>
              <TableCell>{row.normalized.birthdate}</TableCell>
              <TableCell>{row.normalized.gender}</TableCell>
              <TableCell>{row.normalized.domicilio}</TableCell>
              <TableCell>
                {[...row.errors, ...row.warnings, row.importMessage]
                  .filter(Boolean)
                  .map((message) => translatePatientImportMessage(message, t))
                  .join(' | ')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function translatePatientImportMessage(message: string, t: TFunction): string {
  const exactTranslation = validationMessageTranslations[message];
  if (exactTranslation) {
    return t(exactTranslation[0], exactTranslation[1]);
  }

  const minimumLengthMatch = /^(NOMBRES|A\.PATERNO|A\.MATERNO) must have at least 2 characters\.$/.exec(message);
  if (minimumLengthMatch) {
    return t('bulkPatientImportValidationNameTooShort', '{{field}} must have at least 2 characters.', {
      field: minimumLengthMatch[1],
    });
  }

  const maximumLengthMatch = /^(NOMBRES|A\.PATERNO|A\.MATERNO) exceeds the maximum length of (\d+) characters\.$/.exec(
    message,
  );
  if (maximumLengthMatch) {
    return t('bulkPatientImportValidationNameTooLong', '{{field}} exceeds the maximum length of {{max}} characters.', {
      field: maximumLengthMatch[1],
      max: maximumLengthMatch[2],
    });
  }

  const invalidCharactersMatch = /^(NOMBRES|A\.PATERNO|A\.MATERNO) contains invalid characters\.$/.exec(message);
  if (invalidCharactersMatch) {
    return t('bulkPatientImportValidationNameCharacters', '{{field}} contains invalid characters.', {
      field: invalidCharactersMatch[1],
    });
  }

  return message;
}

function StatusTag({ status, t }: { status: ParsedPatientImportRow['status']; t: TFunction }) {
  const tagType =
    status === 'created'
      ? 'green'
      : status === 'reconciled'
        ? 'teal'
        : status === 'failed' || status === 'error'
          ? 'red'
          : status === 'warning'
            ? 'warm-gray'
            : status === 'creating'
              ? 'blue'
              : 'gray';

  return (
    <Tag type={tagType} size="sm">
      {t(`bulkPatientImportStatus_${status}`, status)}
    </Tag>
  );
}

export default BulkPatientImport;
