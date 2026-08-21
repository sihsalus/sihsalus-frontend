import { Button, ButtonSet, Column, Grid, InlineLoading, InlineNotification, Modal, Stack, Tag } from '@carbon/react';
import { Download, Upload } from '@carbon/react/icons';
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

const BulkPatientImport: React.FC<BulkPatientImportProps> = ({ isOffline }) => {
  const { t } = useTranslation(moduleName);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const operationTokenRef = useRef(0);
  const importAbortControllerRef = useRef<AbortController | null>(null);
  const { bulkPatientImport: importConfig } = useConfig<RegistrationConfig>();
  const { currentSession, identifierTypes, identifierTypesError, isLoadingIdentifierTypes } =
    useContext(ResourcesContext);
  const userUuid = currentSession?.user?.uuid;
  const locationUuid = currentSession?.sessionLocation?.uuid;
  const [manifest, setManifest] = useState<PatientImportManifest | null>(null);
  const [hasParseError, setHasParseError] = useState(false);
  const [hasApprovalError, setHasApprovalError] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isPreflighting, setIsPreflighting] = useState(false);
  const [preflightFingerprint, setPreflightFingerprint] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [currentImportRow, setCurrentImportRow] = useState(0);
  const [currentImportTotal, setCurrentImportTotal] = useState(0);
  const limits = getImportLimits();
  const rows = manifest?.rows ?? [];
  const summary = useMemo(() => summarizeImportRows(rows), [rows]);
  const rowsWithErrors = rows.filter((row) => row.errors.length > 0);
  const pendingRows = rows.filter((row) => !row.errors.length && row.status !== 'created');
  const isBusy = isParsing || isPreflighting || isImporting;
  const domicilioTarget =
    importConfig.domicilioTarget === 'address4' || importConfig.domicilioTarget === 'cityVillage'
      ? importConfig.domicilioTarget
      : null;
  const expectedFingerprint =
    manifest && userUuid && locationUuid ? getPreflightFingerprint(manifest, userUuid, locationUuid, importConfig) : '';
  const initialContextApproved =
    importConfig.enabled &&
    Boolean(domicilioTarget) &&
    isCanonicalUtcInstant(importConfig.approvalExpiresAt) &&
    Date.parse(importConfig.approvalExpiresAt) > Date.now() &&
    importConfig.approvedOrigin === globalThis.location.origin &&
    importConfig.approvedUserUuid === userUuid &&
    importConfig.approvedLocationUuid === locationUuid;
  const canPreflight =
    initialContextApproved &&
    !isOffline &&
    !isBusy &&
    Boolean(manifest) &&
    !hasApprovalError &&
    !summary.errors &&
    Boolean(identifierTypes.length) &&
    !identifierTypesError;
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
      const parsedManifest = await parseSantaClotildeWorkbook(file);
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
      updateManifestRows(fileSha256, (row) =>
        result.reconciledRowIds.has(row.id)
          ? {
              ...row,
              status: 'created',
              importMessage: t('bulkPatientImportReconciledMessage', 'Existing patient safely reconciled.'),
            }
          : { ...row, status: row.warnings.length ? 'warning' : 'valid', importMessage: '' },
      );
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
        showFixedFailureSnackbar(t, 'bulkPatientImportPreflightFailedTitle', 'Safety preflight failed');
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
    setCurrentImportRow(0);

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
            ? {
                ...row,
                status: 'created',
                importMessage: t('bulkPatientImportReconciledMessage', 'Existing patient safely reconciled.'),
              }
            : row,
        );
        const rowsToCreate = approvedRows.filter((row) => !secondPreflight.reconciledRowIds.has(row.id));
        setCurrentImportTotal(rowsToCreate.length);

        for (let index = 0; index < rowsToCreate.length; index++) {
          if (operationToken !== operationTokenRef.current || abortController.signal.aborted) {
            throw new Error(bulkPatientImportRowErrorMessage);
          }
          const row = rowsToCreate[index];
          setCurrentImportRow(index + 1);
          updateRow(fileSha256, row.id, { status: 'creating', importMessage: '' });

          try {
            await assertFreshBulkPatientImportContext(
              { config: importConfig, fileSha256, userUuid, locationUuid },
              abortController.signal,
            );
            const patientUuid = await createPatientFromImportRow(row, lockedIdentifierTypes, locationUuid, {
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
              status: 'created',
              patientUuid,
              importMessage: t('bulkPatientImportCreatedMessage', 'Patient created and reconciled.'),
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
        showFixedFailureSnackbar(t, 'bulkPatientImportStoppedTitle', 'Import stopped safely');
      }
    } finally {
      if (operationToken === operationTokenRef.current) {
        setIsImporting(false);
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
              <p>{t('bulkPatientImportSubtitle', 'One-time, fail-closed import of an approved Excel workbook.')}</p>
            </div>
          </header>

          {!importConfig.enabled ? (
            <InlineNotification
              kind="error"
              lowContrast
              title={t('bulkPatientImportDisabledTitle', 'Bulk import is disabled')}
              subtitle={t(
                'bulkPatientImportDisabledSubtitle',
                'An administrator must approve one exact file, build, operator, location, origin, and address mapping.',
              )}
            />
          ) : !initialContextApproved ? (
            <InlineNotification
              kind="error"
              lowContrast
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
              title={t('bulkPatientImportOfflineTitle', 'Import is unavailable while offline')}
              subtitle={t('bulkPatientImportOfflineSubtitle', 'Connect before running clinical safety checks.')}
            />
          ) : null}

          {initialContextApproved ? (
            <section className={styles.toolbar} aria-label={t('bulkPatientImportActions', 'Import actions')}>
              <ButtonSet>
                <Button
                  kind="secondary"
                  renderIcon={Download}
                  disabled={isBusy}
                  onClick={downloadSantaClotildeTemplate}
                >
                  {t('bulkPatientImportDownloadTemplate', 'Download template')}
                </Button>
                <Button
                  kind="primary"
                  renderIcon={Upload}
                  disabled={isBusy || isOffline}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t('bulkPatientImportUploadTemplate', 'Upload Excel')}
                </Button>
              </ButtonSet>
              <input
                ref={fileInputRef}
                className={styles.fileInput}
                type="file"
                disabled={isBusy}
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileChange}
              />
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
              title={t('bulkPatientImportParseErrorTitle', 'Could not read the file')}
              subtitle={t('bulkPatientImportFixedError', bulkPatientImportSafetyErrorMessage)}
            />
          ) : null}

          {hasApprovalError ? (
            <InlineNotification
              kind="error"
              lowContrast
              title={t('bulkPatientImportFileNotApprovedTitle', 'This file is not approved')}
              subtitle={t(
                'bulkPatientImportFileNotApprovedSubtitle',
                'Its SHA-256 does not match the one-time approval. No server request was made.',
              )}
            />
          ) : null}

          {manifest ? (
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

              <section className={styles.summary}>
                <SummaryTile label={t('bulkPatientImportTotalRows', 'Rows')} value={summary.total} />
                <SummaryTile label={t('bulkPatientImportValidRows', 'Valid')} value={summary.valid} />
                <SummaryTile label={t('bulkPatientImportWarningRows', 'Warnings')} value={summary.warnings} />
                <SummaryTile label={t('bulkPatientImportErrorRows', 'Errors')} value={summary.errors} />
                <SummaryTile label={t('bulkPatientImportCreatedRows', 'Created')} value={summary.created} />
                <SummaryTile label={t('bulkPatientImportFailedRows', 'Failed')} value={summary.failed} />
              </section>

              {rowsWithErrors.length ? (
                <InlineNotification
                  kind="error"
                  lowContrast
                  title={t('bulkPatientImportRowsBlockedTitle', 'Some rows have errors')}
                  subtitle={t('bulkPatientImportRowsBlockedSubtitle', 'Correct and reapprove the exact workbook.')}
                />
              ) : null}

              {!identifierTypes.length && !isLoadingIdentifierTypes ? (
                <InlineNotification
                  kind="error"
                  lowContrast
                  title={t('bulkPatientImportNoIdentifierTypesTitle', 'Identifier types unavailable')}
                  subtitle={t('bulkPatientImportNoIdentifierTypesSubtitle', 'No patient can be created safely.')}
                />
              ) : null}

              <section className={styles.actions}>
                <ButtonSet>
                  <Button kind="secondary" disabled={!canPreflight} onClick={runPreflight}>
                    {t('bulkPatientImportRunPreflight', 'Run safety preflight')}
                  </Button>
                  <Button kind="danger" disabled={!canImport} onClick={() => setIsConfirmOpen(true)}>
                    {t('bulkPatientImportCreatePatients', 'Create patients')}
                  </Button>
                  <Button kind="ghost" disabled={isBusy} onClick={() => downloadImportReport(rows)}>
                    {t('bulkPatientImportDownloadReport', 'Download protected report')}
                  </Button>
                </ButtonSet>
                {isImporting ? (
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
                title={t('bulkPatientImportReportPrivacyTitle', 'The report contains clinical identifiers')}
                subtitle={t(
                  'bulkPatientImportReportPrivacySubtitle',
                  'Keep it only in the approved encrypted location and never attach it to a public ticket.',
                )}
              />

              <PatientImportPreview rows={rows.slice(0, previewLimit)} t={t} />
            </>
          ) : null}
        </Stack>
      </Column>

      <Modal
        open={isConfirmOpen}
        modalHeading={t('bulkPatientImportConfirmTitle', 'Create patients')}
        primaryButtonText={t('bulkPatientImportConfirmPrimary', 'Create')}
        secondaryButtonText={t('bulkPatientImportConfirmSecondary', 'Cancel')}
        danger
        onRequestClose={() => setIsConfirmOpen(false)}
        onSecondarySubmit={() => setIsConfirmOpen(false)}
        onRequestSubmit={importRows}
      >
        <p>
          {t(
            'bulkPatientImportConfirmBody',
            'The live preflight will run again under an exclusive lock before creating {{count}} patients. The batch stops on the first uncertain result and has no automatic rollback.',
            { count: pendingRows.length },
          )}
        </p>
        <p>{manifest?.fileSha256}</p>
      </Modal>
    </Grid>
  );
};

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

function showFixedFailureSnackbar(t: TFunction, key: string, title: string) {
  showSnackbar({
    title: t(key, title),
    subtitle: t(
      'bulkPatientImportStoppedSubtitle',
      'No further rows were attempted. Reconcile the current row before retrying.',
    ),
    kind: 'error',
  });
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.summaryTile}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PatientImportPreview({
  rows,
  t,
}: {
  rows: Array<ParsedPatientImportRow>;
  t: (key: string, fallback: string) => string;
}) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('bulkPatientImportRowHeader', 'Row')}</th>
            <th>{t('bulkPatientImportStatusHeader', 'Status')}</th>
            <th>DNI</th>
            <th>{t('bulkPatientImportPatientHeader', 'Patient')}</th>
            <th>{t('bulkPatientImportBirthdateHeader', 'Birthdate')}</th>
            <th>{t('bulkPatientImportSexHeader', 'Sex')}</th>
            <th>{t('bulkPatientImportAddressHeader', 'Address')}</th>
            <th>{t('bulkPatientImportMessagesHeader', 'Messages')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.rowNumber}</td>
              <td>
                <StatusTag status={row.status} t={t} />
              </td>
              <td>{row.normalized.dni}</td>
              <td>
                {[
                  row.normalized.givenName,
                  row.normalized.middleName,
                  row.normalized.familyName,
                  row.normalized.familyName2,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </td>
              <td>{row.normalized.birthdate}</td>
              <td>{row.normalized.gender}</td>
              <td>{row.normalized.domicilio}</td>
              <td>{[...row.errors, ...row.warnings, row.importMessage].filter(Boolean).join(' | ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusTag({
  status,
  t,
}: {
  status: ParsedPatientImportRow['status'];
  t: (key: string, fallback: string) => string;
}) {
  const tagType =
    status === 'created'
      ? 'green'
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
