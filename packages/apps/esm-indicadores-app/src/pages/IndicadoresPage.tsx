import {
  Button,
  InlineLoading,
  Modal,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tile,
} from '@carbon/react';
import { getUserFacingErrorMessage, formatDate, parseDate } from '@openmrs/esm-framework';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import type { Indicador } from '../api/types';
import { indicatorsErrorMessageOptions } from '../features/indicadores/error-handling';
import { notifyError, notifySuccess, useDeleteIndicador, useIndicadores } from '../features/indicadores/hooks';
import styles from '../indicators-dashboard.module.scss';

const IndicadoresPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [deactivationTarget, setDeactivationTarget] = useState<Indicador | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const deletingIdsRef = useRef(new Set<string>());
  const pageSize = 10;
  const { data, isLoading, error } = useIndicadores(page, pageSize);
  const { deleteIndicador } = useDeleteIndicador();

  const handleDelete = async () => {
    const target = deactivationTarget;
    if (!target || deletingIdsRef.current.has(target.id)) {
      return;
    }

    deletingIdsRef.current.add(target.id);
    setDeletingIds(new Set(deletingIdsRef.current));
    try {
      await deleteIndicador(target.id);
      notifySuccess(t('indicatorDeactivated', 'Indicador desactivado'));
      setDeactivationTarget(null);
    } catch (deleteError) {
      notifyError(
        getUserFacingErrorMessage(
          deleteError,
          t('indicatorDeactivationFailed', 'No se pudo desactivar el indicador.'),
          indicatorsErrorMessageOptions(t),
        ),
      );
    } finally {
      deletingIdsRef.current.delete(target.id);
      setDeletingIds(new Set(deletingIdsRef.current));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>{t('indicators', 'Indicadores')}</h2>
          <p className={styles.subtitle}>
            {t('indicatorsPageSubtitle', 'Listado principal del módulo, con acceso a detalle, edición y versionado.')}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button onClick={() => navigate('/new')}>{t('newIndicator', 'Nuevo indicador')}</Button>
        </div>
      </div>

      {isLoading ? <InlineLoading description={t('loadingIndicators', 'Cargando indicadores...')} /> : null}
      {error ? (
        <div className={styles.errorBanner}>
          {getUserFacingErrorMessage(
            error,
            t('indicatorsLoadFailed', 'No se pudieron cargar los indicadores.'),
            indicatorsErrorMessageOptions(t),
          )}
        </div>
      ) : null}

      {!isLoading && !error ? (
        data?.items.length ? (
          <>
            <div className={styles.tableSurface}>
              <Table aria-label={t('indicatorsTableAria', 'Listado de indicadores')}>
                <TableHead>
                  <TableRow>
                    <TableHeader>{t('name', 'Nombre')}</TableHeader>
                    <TableHeader>{t('description', 'Descripción')}</TableHeader>
                    <TableHeader>{t('status', 'Estado')}</TableHeader>
                    <TableHeader>{t('createdAt', 'Creado')}</TableHeader>
                    <TableHeader>{t('actions', 'Acciones')}</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.items.map((indicador) => (
                    <TableRow key={indicador.id}>
                      <TableCell>
                        <Link to={`/${indicador.id}`} className={styles.inlineLink}>
                          {indicador.nombre}
                        </Link>
                      </TableCell>
                      <TableCell>{indicador.descripcion ?? t('noDescription', 'Sin descripción')}</TableCell>
                      <TableCell>
                        <Tag type={indicador.activo ? 'green' : 'gray'}>
                          {indicador.activo ? t('active', 'Activo') : t('inactive', 'Inactivo')}
                        </Tag>
                      </TableCell>
                      <TableCell>{formatDate(parseDate(indicador.creado_en))}</TableCell>
                      <TableCell>
                        <div className={styles.tableActions}>
                          <Button size="sm" kind="ghost" onClick={() => navigate(`/${indicador.id}`)}>
                            {t('view', 'Ver')}
                          </Button>
                          <Button size="sm" kind="ghost" onClick={() => navigate(`/${indicador.id}/edit`)}>
                            {t('edit', 'Editar')}
                          </Button>
                          <Button
                            size="sm"
                            kind="danger--ghost"
                            onClick={() => {
                              if (!deletingIdsRef.current.has(indicador.id)) {
                                setDeactivationTarget(indicador);
                              }
                            }}
                            disabled={deletingIds.has(indicador.id)}
                          >
                            {t('deactivate', 'Desactivar')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              page={data.page}
              pageSize={data.size}
              pageSizes={[10]}
              totalItems={data.total}
              onChange={({ page }: { page: number }) => setPage(page)}
              size="sm"
            />
          </>
        ) : (
          <Tile className={styles.empty}>{t('noIndicatorsYet', 'No hay indicadores definidos aún.')}</Tile>
        )
      ) : null}

      <Modal
        open={Boolean(deactivationTarget)}
        modalHeading={t('deactivateIndicator', 'Desactivar indicador')}
        primaryButtonText={
          deletingIds.has(deactivationTarget?.id ?? '') ? (
            <InlineLoading description={t('deactivating', 'Desactivando...')} />
          ) : (
            t('deactivate', 'Desactivar')
          )
        }
        primaryButtonDisabled={deletingIds.has(deactivationTarget?.id ?? '')}
        secondaryButtonText={t('cancel', 'Cancelar')}
        onRequestClose={() => {
          if (!deletingIds.has(deactivationTarget?.id ?? '')) {
            setDeactivationTarget(null);
          }
        }}
        onRequestSubmit={() => void handleDelete()}
        danger
      >
        <p>
          {t(
            'deactivateIndicatorConfirmation',
            'The indicator "{{name}}" will be deactivated and will no longer be included in active calculations. Do you want to continue?',
            { name: deactivationTarget?.nombre ?? '' },
          )}
        </p>
      </Modal>
    </div>
  );
};

export default IndicadoresPage;
