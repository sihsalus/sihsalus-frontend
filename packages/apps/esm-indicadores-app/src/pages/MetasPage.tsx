import {
  Button,
  DataTable,
  InlineLoading,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { IndicadorDetail, IndicadorMeta } from '../api/types';
import MetaFormModal from '../components/MetaFormModal';
import { notifyError, notifySuccess, useIndicadores } from '../features/indicadores/hooks';
import { useDeleteMeta, useMetas, useUpsertMeta } from '../features/metas/hooks';
import styles from '../indicators-dashboard.module.scss';

interface VersionInfo {
  nombre: string;
  version: number;
}

function buildVersionMap(indicators: Array<IndicadorDetail>): Map<string, VersionInfo> {
  const map = new Map<string, VersionInfo>();
  for (const indicator of indicators) {
    for (const version of indicator.versiones) {
      map.set(version.id, { nombre: indicator.nombre, version: version.version });
    }
  }
  return map;
}

const MetasPage: React.FC = () => {
  const { t } = useTranslation();
  const { data: metas, isLoading, error } = useMetas();
  const { data: indicadoresData } = useIndicadores(1, 100);
  const { upsertMeta } = useUpsertMeta();
  const { deleteMeta } = useDeleteMeta();

  const [isModalOpen, setModalOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<IndicadorMeta | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ indicador_version_id: string; anio: number } | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const versionMap = useMemo(
    () => buildVersionMap(indicadoresData?.items ?? []),
    [indicadoresData?.items],
  );

  const headers = [
    { key: 'indicador', header: t('indicator', 'Indicador') },
    { key: 'version', header: t('version', 'Versión') },
    { key: 'anio', header: t('year', 'Año') },
    { key: 'valor_meta', header: t('targetValue', 'Meta') },
    { key: 'acciones', header: t('actions', 'Acciones') },
  ];

  const rows = useMemo(() => {
    return (metas ?? []).map((meta) => {
      const info = versionMap.get(meta.indicador_version_id);
      return {
        id: meta.id,
        indicador: info?.nombre ?? '-',
        version: info?.version ?? '-',
        anio: meta.anio,
        valor_meta: meta.valor_meta,
      };
    });
  }, [metas, versionMap]);

  const handleOpenCreate = () => {
    setEditingMeta(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (meta: IndicadorMeta) => {
    setEditingMeta(meta);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSubmitting) {
      return;
    }
    setModalOpen(false);
    setEditingMeta(null);
  };

  const handleSubmit = async (payload: { indicador_version_id: string; anio: number; valor_meta: number }) => {
    setSubmitting(true);
    try {
      await upsertMeta(payload);
      notifySuccess(t('metaSaved', 'Meta guardada'));
      setModalOpen(false);
      setEditingMeta(null);
    } catch (submitError) {
      notifyError(submitError instanceof Error ? submitError.message : t('metaSaveFailed', 'No se pudo guardar la meta'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    try {
      await deleteMeta(deleteTarget.indicador_version_id, deleteTarget.anio);
      notifySuccess(t('metaDeleted', 'Meta eliminada'));
    } catch (deleteError) {
      notifyError(deleteError instanceof Error ? deleteError.message : t('metaDeleteFailed', 'No se pudo eliminar la meta'));
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>{t('metasTitle', 'Metas')}</h2>
          <p className={styles.subtitle}>{t('metasSubtitle', 'Administrá las metas anuales por indicador y versión.')}</p>
        </div>
        <div className={styles.headerActions}>
          <Button onClick={handleOpenCreate}>{t('newMeta', 'Nueva meta')}</Button>
        </div>
      </div>

      {isLoading ? <InlineLoading description={t('loadingMetas', 'Cargando metas...')} /> : null}
      {error ? <div className={styles.errorBanner}>{error.message}</div> : null}

      {!isLoading && !error ? (
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
                      {rows.map((row) => {
                        // Find the original meta by ID to access its properties
                        const originalMeta = metas?.find((m) => m.id === row.id);
                        return (
                          <TableRow key={row.id}>
                            {row.cells.map((cell) =>
                              cell.info.header === 'acciones' ? (
                                <TableCell key={cell.id}>
                                  <div className={styles.tableActions}>
                                    <Button
                                      size="sm"
                                      kind="ghost"
                                      onClick={() => handleOpenEdit(originalMeta as IndicadorMeta)}
                                    >
                                      {t('edit', 'Editar')}
                                    </Button>
                                    <Button
                                      size="sm"
                                      kind="danger--ghost"
                                      onClick={() =>
                                        originalMeta &&
                                        setDeleteTarget({
                                          indicador_version_id: originalMeta.indicador_version_id,
                                          anio: originalMeta.anio,
                                        })
                                      }
                                    >
                                      {t('delete', 'Eliminar')}
                                    </Button>
                                  </div>
                                </TableCell>
                              ) : (
                                <TableCell key={cell.id}>{cell.value}</TableCell>
                              ),
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
          </div>
        ) : (
          <Tile className={styles.empty}>{t('noMetas', 'No hay metas configuradas.')}</Tile>
        )
      ) : null}

      {isModalOpen ? (
        <MetaFormModal
          isOpen
          indicators={indicadoresData?.items ?? []}
          initialMeta={editingMeta}
          isSubmitting={isSubmitting}
          onClose={handleCloseModal}
          onSubmit={handleSubmit}
        />
      ) : null}

      <Modal
        open={Boolean(deleteTarget)}
        modalHeading={t('deleteMeta', 'Eliminar meta')}
        primaryButtonText={t('delete', 'Eliminar')}
        secondaryButtonText={t('cancel', 'Cancelar')}
        onRequestClose={() => setDeleteTarget(null)}
        onRequestSubmit={handleConfirmDelete}
        danger
      >
        <p>{t('deleteMetaConfirmation', '¿Estás seguro de que querés eliminar esta meta?')}</p>
      </Modal>
    </div>
  );
};

export default MetasPage;
