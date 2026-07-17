import {
  Button,
  InlineLoading,
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
import { getUserFacingErrorMessage } from '@openmrs/esm-framework';
import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { indicatorsErrorMessageOptions } from '../features/indicadores/error-handling';
import { notifyError, notifySuccess, useDeleteIndicador, useIndicadores } from '../features/indicadores/hooks';
import styles from '../indicators-dashboard.module.scss';

const IndicadoresPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const deletingIdsRef = useRef(new Set<string>());
  const pageSize = 10;
  const { data, isLoading, error } = useIndicadores(page, pageSize);
  const { deleteIndicador } = useDeleteIndicador();

  const handleDelete = async (id: string) => {
    if (deletingIdsRef.current.has(id)) {
      return;
    }

    deletingIdsRef.current.add(id);
    setDeletingIds(new Set(deletingIdsRef.current));
    try {
      await deleteIndicador(id);
      notifySuccess('Indicador desactivado');
    } catch (deleteError) {
      notifyError(
        getUserFacingErrorMessage(deleteError, 'No se pudo desactivar el indicador.', indicatorsErrorMessageOptions),
      );
    } finally {
      deletingIdsRef.current.delete(id);
      setDeletingIds(new Set(deletingIdsRef.current));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2>Indicadores</h2>
          <p className={styles.subtitle}>Listado principal del módulo, con acceso a detalle, edición y versionado.</p>
        </div>
        <div className={styles.headerActions}>
          <Button onClick={() => navigate('/new')}>Nuevo indicador</Button>
        </div>
      </div>

      {isLoading ? <InlineLoading description="Cargando indicadores..." /> : null}
      {error ? (
        <div className={styles.errorBanner}>
          {getUserFacingErrorMessage(error, 'No se pudieron cargar los indicadores.', indicatorsErrorMessageOptions)}
        </div>
      ) : null}

      {!isLoading && !error ? (
        data?.items.length ? (
          <>
            <div className={styles.tableSurface}>
              <Table aria-label="Listado de indicadores">
                <TableHead>
                  <TableRow>
                    <TableHeader>Nombre</TableHeader>
                    <TableHeader>Descripción</TableHeader>
                    <TableHeader>Estado</TableHeader>
                    <TableHeader>Creado</TableHeader>
                    <TableHeader>Acciones</TableHeader>
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
                      <TableCell>{indicador.descripcion ?? 'Sin descripción'}</TableCell>
                      <TableCell>
                        <Tag type="green">Activo</Tag>
                      </TableCell>
                      <TableCell>{new Date(indicador.creado_en).toLocaleString('es-PE')}</TableCell>
                      <TableCell>
                        <div className={styles.tableActions}>
                          <Button size="sm" kind="ghost" onClick={() => navigate(`/${indicador.id}`)}>
                            Ver
                          </Button>
                          <Button size="sm" kind="ghost" onClick={() => navigate(`/${indicador.id}/edit`)}>
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            kind="danger--ghost"
                            onClick={() => handleDelete(indicador.id)}
                            disabled={deletingIds.has(indicador.id)}
                          >
                            Desactivar
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
          <Tile className={styles.empty}>No hay indicadores cargados.</Tile>
        )
      ) : null}
    </div>
  );
};

export default IndicadoresPage;
