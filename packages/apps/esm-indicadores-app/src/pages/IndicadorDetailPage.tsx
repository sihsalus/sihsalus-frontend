import { Accordion, AccordionItem, Button, Tag, Tile } from '@carbon/react';
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import DefinicionView from '../components/DefinicionView';
import IndicadorForm from '../components/IndicadorForm';
import SQLPreviewSection from '../components/SQLPreviewSection';
import type { DefinicionIndicadorForm } from '../api/types';
import { notifyError, notifySuccess, useCreateVersion, useIndicador } from '../features/indicadores/hooks';
import { parseDefinicion } from '../features/indicadores/parseDefinicion';
import styles from '../indicators-dashboard.module.scss';

const IndicadorDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showVersionForm, setShowVersionForm] = useState(false);
  const { data, isLoading, error } = useIndicador(id);
  const { createVersion } = useCreateVersion(id);

  const latestVersion = useMemo(() => data?.versiones.reduce((max, version) => (version.version > max.version ? version : max), data.versiones[0]), [data]);

  const handleCreateVersion = async ({ definicion }: { metadata: { nombre: string; descripcion: string | null }; definicion?: DefinicionIndicadorForm }) => {
    if (!definicion) {
      return;
    }

    setServerError(null);

    try {
      await createVersion(definicion);
      setShowVersionForm(false);
      notifySuccess('Versión creada');
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'No se pudo crear la versión';
      setServerError(message);
      notifyError(message);
    }
  };

  return (
    <div className={styles.container}>
      <Link to="/" className={styles.backLink}>Volver a indicadores</Link>

      {isLoading ? <p>Cargando indicador...</p> : null}
      {error ? <div className={styles.errorBanner}>{error.message}</div> : null}

      {data ? (
        <div className={styles.detailLayout}>
          <Tile className={styles.detailCard}>
            <div className={styles.header}>
              <div>
                <h2>{data.nombre}</h2>
                <p className={styles.subtitle}>{data.descripcion ?? 'Sin descripción'}</p>
              </div>
              <Tag type={data.activo ? 'green' : 'gray'}>{data.activo ? 'Activo' : 'Inactivo'}</Tag>
            </div>
            <div className={styles.headerActions}>
              <Button size="sm" onClick={() => navigate(`/${data.id}/edit`)}>Editar metadata</Button>
              <Button size="sm" kind="secondary" onClick={() => setShowVersionForm((value) => !value)}>
                {showVersionForm ? 'Cancelar nueva versión' : 'Nueva versión'}
              </Button>
            </div>
          </Tile>

          {showVersionForm ? (
            <Tile className={styles.section}>
              <h3 className={styles.sectionTitle}>Crear nueva versión</h3>
              <IndicadorForm
                mode="version"
                defaultValues={latestVersion ? parseDefinicion(latestVersion.definicion) : undefined}
                initialMetadata={{ nombre: data.nombre, descripcion: data.descripcion }}
                serverError={serverError}
                onSubmit={handleCreateVersion}
              />
            </Tile>
          ) : null}

          {latestVersion ? (
            <Tile className={styles.section}>
              <h3 className={styles.sectionTitle}>Definición actual</h3>
              <DefinicionView definicion={latestVersion.definicion} />
              <SQLPreviewSection indicadorId={data.id} versionId={latestVersion.id} versionNum={latestVersion.version} />
            </Tile>
          ) : null}

          <Tile className={styles.section}>
            <h3 className={styles.sectionTitle}>Historial de versiones</h3>
            <Accordion>
              {data.versiones.map((version) => (
                <AccordionItem key={version.id} title={`Versión #${version.version} - ${new Date(version.creado_en).toLocaleString('es-PE')}`}>
                  <DefinicionView definicion={version.definicion} />
                  <SQLPreviewSection indicadorId={data.id} versionId={version.id} versionNum={version.version} />
                </AccordionItem>
              ))}
            </Accordion>
          </Tile>
        </div>
      ) : null}
    </div>
  );
};

export default IndicadorDetailPage;
