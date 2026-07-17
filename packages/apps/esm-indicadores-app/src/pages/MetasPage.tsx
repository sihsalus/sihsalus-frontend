import {
  Button,
  ComboBox,
  DataTable,
  InlineLoading,
  Modal,
  NumberInput,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import { getUserFacingErrorMessage } from '@openmrs/esm-framework';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Indicador, IndicadorMeta, IndicadorMetaCreatePayload } from '../api/types';
import MetaFormModal from '../components/MetaFormModal';
import { indicatorsErrorMessageOptions } from '../features/indicadores/error-handling';
import { notifyError, notifySuccess, useIndicadores } from '../features/indicadores/hooks';
import { useDeleteMeta, useMetaByIndicator, useUpsertMeta } from '../features/metas/hooks';
import styles from '../indicators-dashboard.module.scss';

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

const MetasPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedIndicatorId, setSelectedIndicatorId] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<IndicadorMeta | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IndicadorMeta | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const submitLockRef = useRef(false);
  const deleteLockRef = useRef(false);

  const { data: indicatorsData, isLoading: indicatorsLoading, error: indicatorsError } = useIndicadores(1, 100);
  const indicators = indicatorsData?.items ?? [];
  const selectedIndicator = indicators.find((indicator) => indicator.id === selectedIndicatorId) ?? null;
  const {
    data: meta,
    isLoading: metaLoading,
    error: metaError,
  } = useMetaByIndicator(selectedIndicatorId, selectedIndicatorId ? selectedYear : null);
  const { upsertMeta } = useUpsertMeta();
  const { deleteMeta } = useDeleteMeta();

  const headers = [
    { key: 'indicador', header: t('indicator', 'Indicador') },
    { key: 'version', header: t('version', 'Versión') },
    { key: 'anio', header: t('year', 'Año') },
    { key: 'valor_meta', header: t('targetValue', 'Meta') },
    { key: 'acciones', header: t('actions', 'Acciones') },
  ];

  const rows = useMemo(
    () =>
      meta
        ? [
            {
              id: meta.id,
              indicador: meta.indicador_nombre,
              version: meta.version_numero,
              anio: meta.anio,
              valor_meta: meta.valor_meta,
            },
          ]
        : [],
    [meta],
  );

  const handleOpenCreate = () => {
    setEditingMeta(null);
    setModalOpen(true);
  };

  const handleOpenEdit = () => {
    if (meta) {
      setEditingMeta(meta);
      setModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    if (!isSubmitting) {
      setModalOpen(false);
      setEditingMeta(null);
    }
  };

  const handleSubmit = async (payload: IndicadorMetaCreatePayload, indicatorId: string) => {
    if (submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    try {
      await upsertMeta(payload);
      setSelectedIndicatorId(indicatorId);
      setSelectedYear(payload.anio);
      notifySuccess(t('metaSaved', 'Meta guardada'));
      setModalOpen(false);
      setEditingMeta(null);
    } catch (submitError) {
      notifyError(
        getUserFacingErrorMessage(
          submitError,
          t('metaSaveFailed', 'No se pudo guardar la meta.'),
          indicatorsErrorMessageOptions,
        ),
      );
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleteLockRef.current) {
      return;
    }

    const target = deleteTarget;
    deleteLockRef.current = true;
    setDeleting(true);
    try {
      await deleteMeta(target.indicador_version_id, target.anio);
      notifySuccess(t('metaDeleted', 'Meta eliminada'));
    } catch (deleteError) {
      notifyError(
        getUserFacingErrorMessage(
          deleteError,
          t('metaDeleteFailed', 'No se pudo eliminar la meta.'),
          indicatorsErrorMessageOptions,
        ),
      );
    } finally {
      setDeleteTarget(null);
      setDeleting(false);
      deleteLockRef.current = false;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>{t('metasTitle', 'Metas')}</h2>
          <p className={styles.subtitle}>
            {t('metasSubtitle', 'Consultá y administrá la meta anual de un indicador.')}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button onClick={handleOpenCreate}>{t('newMeta', 'Nueva meta')}</Button>
        </div>
      </div>

      <div className={styles.filtersPanel}>
        <ComboBox
          id="meta-filter-indicator"
          titleText={t('indicator', 'Indicador')}
          items={indicators}
          itemToString={(item?: Indicador) => item?.nombre ?? ''}
          selectedItem={selectedIndicator}
          onChange={({ selectedItem }: { selectedItem: Indicador | null | undefined }) =>
            setSelectedIndicatorId(selectedItem?.id ?? '')
          }
          placeholder={t('selectIndicator', 'Seleccioná un indicador')}
          disabled={indicatorsLoading || Boolean(indicatorsError)}
        />
        <NumberInput
          id="meta-filter-year"
          label={t('year', 'Año')}
          min={MIN_YEAR}
          max={MAX_YEAR}
          value={selectedYear}
          onChange={(_event, { value }) => {
            const nextYear = Number(value);
            if (Number.isInteger(nextYear) && nextYear >= MIN_YEAR && nextYear <= MAX_YEAR) {
              setSelectedYear(nextYear);
            }
          }}
        />
      </div>

      {indicatorsLoading ? <InlineLoading description={t('loadingIndicators', 'Cargando indicadores...')} /> : null}
      {indicatorsError ? (
        <div className={styles.errorBanner}>
          {getUserFacingErrorMessage(
            indicatorsError,
            t('indicatorsLoadFailed', 'No se pudieron cargar los indicadores.'),
            indicatorsErrorMessageOptions,
          )}
        </div>
      ) : null}
      {metaLoading ? <InlineLoading description={t('loadingMetas', 'Cargando meta...')} /> : null}
      {metaError ? (
        <div className={styles.errorBanner}>
          {getUserFacingErrorMessage(
            metaError,
            t('metasLoadFailed', 'No se pudo consultar la meta.'),
            indicatorsErrorMessageOptions,
          )}
        </div>
      ) : null}

      {!selectedIndicatorId && !indicatorsLoading && !indicatorsError ? (
        <Tile className={styles.empty}>
          {t('selectMetaLookup', 'Seleccioná un indicador y un año para consultar su meta.')}
        </Tile>
      ) : null}

      {selectedIndicatorId && !metaLoading && !metaError ? (
        rows.length ? (
          <div className={`${styles.tableSurface} ${styles.metasTable}`}>
            <DataTable rows={rows} headers={headers}>
              {({ rows, getHeaderProps, getTableProps }) => (
                <TableContainer>
                  <Table {...getTableProps()} aria-label={t('metasTableAria', 'Tabla de metas')}>
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader {...getHeaderProps({ header })} key={header.key}>
                            {header.header}
                          </TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          {row.cells.map((cell) =>
                            cell.info.header === 'acciones' ? (
                              <TableCell key={cell.id}>
                                <div className={styles.tableActions}>
                                  <Button size="sm" kind="ghost" onClick={handleOpenEdit}>
                                    {t('edit', 'Editar')}
                                  </Button>
                                  <Button size="sm" kind="danger--ghost" onClick={() => meta && setDeleteTarget(meta)}>
                                    {t('delete', 'Eliminar')}
                                  </Button>
                                </div>
                              </TableCell>
                            ) : (
                              <TableCell key={cell.id}>{cell.value}</TableCell>
                            ),
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
          </div>
        ) : (
          <Tile className={styles.empty}>
            {t('noMetaForSelection', 'No hay una meta configurada para el indicador y año seleccionados.')}
          </Tile>
        )
      ) : null}

      {isModalOpen ? (
        <MetaFormModal
          isOpen
          initialMeta={editingMeta}
          initialIndicatorId={selectedIndicatorId || undefined}
          isSubmitting={isSubmitting}
          onClose={handleCloseModal}
          onSubmit={handleSubmit}
        />
      ) : null}

      <Modal
        open={Boolean(deleteTarget)}
        modalHeading={t('deleteMeta', 'Eliminar meta')}
        primaryButtonText={t('delete', 'Eliminar')}
        primaryButtonDisabled={isDeleting}
        secondaryButtonText={t('cancel', 'Cancelar')}
        onRequestClose={() => {
          if (!isDeleting) {
            setDeleteTarget(null);
          }
        }}
        onRequestSubmit={handleConfirmDelete}
        danger
      >
        <p>{t('deleteMetaConfirmation', '¿Estás seguro de que querés eliminar esta meta?')}</p>
      </Modal>
    </div>
  );
};

export default MetasPage;
