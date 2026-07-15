import { Button, ButtonSet, Column, Grid, InlineLoading, InlineNotification, Modal, Stack, Tag } from '@carbon/react';
import { Download, Upload } from '@carbon/react/icons';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useContext, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { moduleName } from '../constants';
import { ResourcesContext } from '../offline.resources';
import styles from './bulk-patient-import.scss';
import type { ParsedPatientImportRow } from './bulk-patient-import.types';
import {
  createPatientFromImportRow,
  downloadImportReport,
  downloadSantaClotildeTemplate,
  getImportErrorMessage,
  getImportLimits,
  parseSantaClotildeWorkbook,
  summarizeImportRows,
} from './bulk-patient-import.utils';

interface BulkPatientImportProps {
  isOffline: boolean;
}

const previewLimit = 100;

const BulkPatientImport: React.FC<BulkPatientImportProps> = ({ isOffline }) => {
  const { t } = useTranslation(moduleName);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentSession, identifierTypes, isLoadingIdentifierTypes } = useContext(ResourcesContext);
  const locationUuid = currentSession?.sessionLocation?.uuid;
  const [rows, setRows] = useState<Array<ParsedPatientImportRow>>([]);
  const [parseError, setParseError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [currentImportRow, setCurrentImportRow] = useState(0);
  const limits = getImportLimits();
  const summary = useMemo(() => summarizeImportRows(rows), [rows]);
  const rowsWithErrors = rows.filter((row) => row.errors.length > 0);
  const importableRows = rows.filter((row) => !row.errors.length && row.status !== 'created');
  const canImport =
    !isOffline &&
    !isParsing &&
    !isImporting &&
    !!locationUuid &&
    !!identifierTypes.length &&
    !!importableRows.length &&
    !summary.errors;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsParsing(true);
    setRows([]);
    setParseError('');
    setCurrentImportRow(0);

    try {
      const parsedRows = await parseSantaClotildeWorkbook(file);
      setRows(parsedRows);
    } catch (error: unknown) {
      setParseError(
        getImportErrorMessage(
          error,
          t(
            'bulkPatientImportParseFailureSafe',
            'No se pudo procesar el archivo. Verifique que use la plantilla vigente e intente nuevamente.',
          ),
          'Parse bulk patient import workbook',
        ),
      );
    } finally {
      setIsParsing(false);
      event.target.value = '';
    }
  };

  const importRows = async () => {
    setIsConfirmOpen(false);
    setIsImporting(true);
    setCurrentImportRow(0);

    for (let index = 0; index < importableRows.length; index++) {
      const row = importableRows[index];
      setCurrentImportRow(index + 1);
      updateRow(row.id, { status: 'creating', importMessage: '' });

      try {
        const patientUuid = await createPatientFromImportRow(row, identifierTypes, locationUuid);
        updateRow(row.id, {
          status: 'created',
          patientUuid,
          importMessage: t('bulkPatientImportCreatedMessage', 'Paciente creado.'),
        });
      } catch (error) {
        updateRow(row.id, {
          status: 'failed',
          importMessage: getImportErrorMessage(
            error,
            t(
              'bulkPatientImportRowFailureSafe',
              'No se pudo confirmar la creación de esta fila. Busque al paciente por documento antes de reintentar.',
            ),
            'Create patient from bulk import row',
          ),
        });
      }
    }

    setIsImporting(false);
    showSnackbar({
      title: t('bulkPatientImportFinishedTitle', 'Importacion finalizada'),
      subtitle: t('bulkPatientImportFinishedSubtitle', 'Revise el reporte de filas para confirmar el resultado.'),
      kind: 'success',
    });
  };

  const updateRow = (rowId: string, updates: Partial<ParsedPatientImportRow>) => {
    setRows((currentRows) => currentRows.map((row) => (row.id === rowId ? { ...row, ...updates } : row)));
  };

  return (
    <Grid className={styles.page}>
      <Column sm={4} md={8} lg={16}>
        <Stack gap={6}>
          <header className={styles.header}>
            <div>
              <h1>{t('bulkPatientImportTitle', 'Importar pacientes')}</h1>
              <p>
                {t(
                  'bulkPatientImportSubtitle',
                  'Importar pacientes de forma masiva desde una plantilla Excel.\nNota: Orden y Parentesco no se guardan en los datos del paciente, solo se muestran en el reporte.',
                )}
              </p>
            </div>
          </header>

          {isOffline ? (
            <InlineNotification
              kind="error"
              lowContrast
              title={t('bulkPatientImportOfflineTitle', 'Importacion no disponible sin conexion')}
              subtitle={t(
                'bulkPatientImportOfflineSubtitle',
                'Conectese para crear pacientes usando los servicios de SIH Salus.',
              )}
            />
          ) : null}

          <section className={styles.toolbar} aria-label={t('bulkPatientImportActions', 'Acciones de importacion')}>
            <ButtonSet>
              <Button kind="secondary" renderIcon={Download} onClick={downloadSantaClotildeTemplate}>
                {t('bulkPatientImportDownloadTemplate', 'Descargar plantilla')}
              </Button>
              <Button kind="primary" renderIcon={Upload} onClick={() => fileInputRef.current?.click()}>
                {t('bulkPatientImportUploadTemplate', 'Cargar Excel')}
              </Button>
            </ButtonSet>
            <input
              ref={fileInputRef}
              className={styles.fileInput}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
            />
            <p>
              {t('bulkPatientImportLimits', 'Limites: {{rows}} filas y {{mb}} MB por archivo.', {
                rows: limits.maxRows,
                mb: Math.round(limits.maxFileSizeBytes / 1024 / 1024),
              })}
            </p>
          </section>

          {isParsing ? <InlineLoading description={t('bulkPatientImportParsing', 'Leyendo archivo...')} /> : null}

          {parseError ? (
            <InlineNotification
              kind="error"
              lowContrast
              title={t('bulkPatientImportParseErrorTitle', 'No se pudo leer el archivo')}
              subtitle={parseError}
            />
          ) : null}

          {rows.length ? (
            <>
              <section className={styles.summary}>
                <SummaryTile label={t('bulkPatientImportTotalRows', 'Filas')} value={summary.total} />
                <SummaryTile label={t('bulkPatientImportValidRows', 'Validas')} value={summary.valid} />
                <SummaryTile label={t('bulkPatientImportWarningRows', 'Advertencias')} value={summary.warnings} />
                <SummaryTile label={t('bulkPatientImportErrorRows', 'Errores')} value={summary.errors} />
                <SummaryTile label={t('bulkPatientImportCreatedRows', 'Creados')} value={summary.created} />
                <SummaryTile label={t('bulkPatientImportFailedRows', 'Fallidos')} value={summary.failed} />
              </section>

              {rowsWithErrors.length ? (
                <InlineNotification
                  kind="error"
                  lowContrast
                  title={t('bulkPatientImportRowsBlockedTitle', 'Hay filas con errores')}
                  subtitle={t(
                    'bulkPatientImportRowsBlockedSubtitle',
                    'Corrija el archivo y vuelva a cargarlo antes de crear pacientes.',
                  )}
                />
              ) : null}

              {!locationUuid ? (
                <InlineNotification
                  kind="error"
                  lowContrast
                  title={t('bulkPatientImportNoLocationTitle', 'Ubicacion de sesion requerida')}
                  subtitle={t(
                    'bulkPatientImportNoLocationSubtitle',
                    'Seleccione una ubicacion de sesion antes de crear pacientes.',
                  )}
                />
              ) : null}

              {!identifierTypes.length && !isLoadingIdentifierTypes ? (
                <InlineNotification
                  kind="error"
                  lowContrast
                  title={t('bulkPatientImportNoIdentifierTypesTitle', 'Tipos de identificador no disponibles')}
                  subtitle={t(
                    'bulkPatientImportNoIdentifierTypesSubtitle',
                    'Actualice la pagina y confirme que los tipos de identificador estan configurados.',
                  )}
                />
              ) : null}

              <section className={styles.actions}>
                <ButtonSet>
                  <Button kind="primary" disabled={!canImport} onClick={() => setIsConfirmOpen(true)}>
                    {t('bulkPatientImportCreatePatients', 'Crear pacientes')}
                  </Button>
                  <Button kind="secondary" onClick={() => downloadImportReport(rows)}>
                    {t('bulkPatientImportDownloadReport', 'Descargar reporte')}
                  </Button>
                </ButtonSet>
                {isImporting ? (
                  <InlineLoading
                    description={t('bulkPatientImportProgress', 'Creando {{current}} de {{total}} pacientes...', {
                      current: currentImportRow,
                      total: importableRows.length,
                    })}
                  />
                ) : null}
              </section>

              <PatientImportPreview rows={rows.slice(0, previewLimit)} />

              {rows.length > previewLimit ? (
                <p className={styles.previewLimit}>
                  {t('bulkPatientImportPreviewLimit', 'Mostrando las primeras {{count}} filas.', {
                    count: previewLimit,
                  })}
                </p>
              ) : null}
            </>
          ) : null}
        </Stack>
      </Column>

      <Modal
        open={isConfirmOpen}
        modalHeading={t('bulkPatientImportConfirmTitle', 'Crear pacientes')}
        primaryButtonText={t('bulkPatientImportConfirmPrimary', 'Crear')}
        secondaryButtonText={t('bulkPatientImportConfirmSecondary', 'Cancelar')}
        danger
        onRequestClose={() => setIsConfirmOpen(false)}
        onSecondarySubmit={() => setIsConfirmOpen(false)}
        onRequestSubmit={importRows}
      >
        <p>
          {t(
            'bulkPatientImportConfirmBody',
            'Se crearan {{count}} pacientes usando las APIs actuales de registro. Esta accion no tiene rollback automatico.',
            { count: importableRows.length },
          )}
        </p>
      </Modal>
    </Grid>
  );
};

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.summaryTile}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PatientImportPreview({ rows }: { rows: Array<ParsedPatientImportRow> }) {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Fila</th>
            <th>Estado</th>
            <th>DNI</th>
            <th>Paciente</th>
            <th>F.N.</th>
            <th>Sexo</th>
            <th>Domicilio</th>
            <th>Mensajes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.rowNumber}</td>
              <td>
                <StatusTag status={row.status} />
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
              <td>
                {[...row.errors, ...row.warnings, row.importMessage].filter(Boolean).join(' | ')}
                {row.patientUuid ? ` | ${row.patientUuid}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusTag({ status }: { status: ParsedPatientImportRow['status'] }) {
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
      {status}
    </Tag>
  );
}

export default BulkPatientImport;
