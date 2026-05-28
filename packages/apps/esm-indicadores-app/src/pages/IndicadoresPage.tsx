import { Button, InlineLoading, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag, Tile } from '@carbon/react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import PaginationBar from '../components/PaginationBar';
import { notifyError, notifySuccess, useDeleteIndicador, useIndicadores } from '../features/indicadores/hooks';
import styles from '../indicators-dashboard.module.scss';

const IndicadoresPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { data, isLoading, error } = useIndicadores(page, pageSize);
  const { deleteIndicador } = useDeleteIndicador();

  const handleDelete = async (id: string) => {
    try {
      await deleteIndicador(id);
      notifySuccess('Indicador eliminado');
    } catch (deleteError) {
      notifyError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el indicador');
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
      {error ? <div className={styles.errorBanner}>{error.message}</div> : null}

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
                      <Link to={`/${indicador.id}`} className={styles.inlineLink}>{indicador.nombre}</Link>
                    </TableCell>
                    <TableCell>{indicador.descripcion ?? 'Sin descripción'}</TableCell>
                    <TableCell>
                      <Tag type={indicador.activo ? 'green' : 'gray'}>{indicador.activo ? 'Activo' : 'Inactivo'}</Tag>
                    </TableCell>
                    <TableCell>{new Date(indicador.creado_en).toLocaleString('es-PE')}</TableCell>
                    <TableCell>
                      <div className={styles.tableActions}>
                        <Button size="sm" kind="ghost" onClick={() => navigate(`/${indicador.id}`)}>Ver</Button>
                        <Button size="sm" kind="ghost" onClick={() => navigate(`/${indicador.id}/edit`)}>Editar</Button>
                        <Button size="sm" kind="danger--ghost" onClick={() => handleDelete(indicador.id)}>Eliminar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
            </div>
            <PaginationBar entityLabel="indicadores" page={data.page} pageSize={data.size} total={data.total} totalPages={data.pages} onPageChange={setPage} />
          </>
        ) : (
          <Tile className={styles.empty}>No hay indicadores cargados.</Tile>
        )
      ) : null}
    </div>
  );
};

export default IndicadoresPage;
