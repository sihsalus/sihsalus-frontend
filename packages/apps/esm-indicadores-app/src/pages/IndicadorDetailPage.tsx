import { Button, Tag, Tile } from '@carbon/react';
import { getUserFacingErrorMessage } from '@openmrs/esm-framework';
import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { DefinicionIndicadorForm } from '../api/types';
import DefinicionView from '../components/DefinicionView';
import IndicadorForm from '../components/IndicadorForm';
import SQLPreviewSection from '../components/SQLPreviewSection';
import { indicatorsErrorMessageOptions } from '../features/indicadores/error-handling';
import {
  notifyError,
  notifySuccess,
  useCreateVersion,
  useIndicador,
  useResolvedOrdenes,
} from '../features/indicadores/hooks';
import { parseDefinicion } from '../features/indicadores/parseDefinicion';
import styles from '../indicators-dashboard.module.scss';

const formatVersionDate = (iso: string) => new Date(iso).toLocaleString('es-PE');

const IndicadorDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [isSubmittingVersion, setSubmittingVersion] = useState(false);
  const submittingVersionRef = useRef(false);
  const { data, isLoading, error } = useIndicador(id);
  const { createVersion } = useCreateVersion(id);

  const latestVersion = useMemo(
    () => data?.versiones.reduce((max, version) => (version.version > max.version ? version : max), data.versiones[0]),
    [data],
  );

  const ordenUuids = useMemo(() => {
    if (!latestVersion) {
      return [];
    }
    return latestVersion.definicion.evento?.ordenes?.map((item) => item.concepto_uuid) ?? [];
  }, [latestVersion]);

  const { data: ordenesData } = useResolvedOrdenes(ordenUuids);

  const handleCreateVersion = async ({
    definicion,
  }: {
    metadata: { nombre: string; descripcion: string | null };
    definicion?: DefinicionIndicadorForm;
  }) => {
    if (!definicion) {
      return;
    }
    if (submittingVersionRef.current) {
      return;
    }
    submittingVersionRef.current = true;

    setServerError(null);
    setSubmittingVersion(true);

    try {
      await createVersion(definicion);
      setShowVersionForm(false);
      notifySuccess('Versión creada');
    } catch (createError) {
      const message = getUserFacingErrorMessage(
        createError,
        'No se pudo crear la versión.',
        indicatorsErrorMessageOptions,
      );
      setServerError(message);
      notifyError(message);
    } finally {
      submittingVersionRef.current = false;
      setSubmittingVersion(false);
    }
  };

  return (
    <div className={styles.container}>
      <Link to="/" className={styles.backLink}>
        Volver a indicadores
      </Link>

      {isLoading ? <p>Cargando indicador...</p> : null}
      {error ? (
        <div className={styles.errorBanner}>
          {getUserFacingErrorMessage(error, 'No se pudo cargar el indicador.', indicatorsErrorMessageOptions)}
        </div>
      ) : null}

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
              <Button size="sm" onClick={() => navigate(`/${data.id}/edit`)}>
                Editar metadata
              </Button>
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
                defaultValues={latestVersion ? parseDefinicion(latestVersion.definicion, ordenesData) : undefined}
                initialMetadata={{ nombre: data.nombre, descripcion: data.descripcion }}
                serverError={serverError}
                isSubmitting={isSubmittingVersion}
                onSubmit={handleCreateVersion}
              />
            </Tile>
          ) : null}

          <div className={styles.detailGrid}>
            <div className={styles.detailMain}>
              {latestVersion ? (
                <Tile className={styles.detailCard}>
                  <h3 className={styles.sectionTitle}>Definición actual</h3>
                  <div className={styles.versionMeta}>
                    <span>
                      <strong>Versión:</strong> #{latestVersion.version}
                    </span>
                    <span>
                      <strong>Creado:</strong> {formatVersionDate(latestVersion.creado_en)}
                    </span>
                  </div>
                  <DefinicionView definicion={latestVersion.definicion} />
                  <SQLPreviewSection
                    indicadorId={data.id}
                    versionId={latestVersion.id}
                    versionNum={latestVersion.version}
                  />
                </Tile>
              ) : null}
            </div>

            <aside className={styles.detailAside}>
              <h3 className={styles.sectionTitle}>Historial de versiones</h3>
              <ol className={styles.historyList} aria-label="Versiones del indicador">
                {data.versiones.map((version) => (
                  <li key={version.id} className={styles.historyItem}>
                    <details className={styles.historyDetails}>
                      <summary className={styles.historySummary}>
                        <span className={styles.historyItemTitle}>Versión #{version.version}</span>
                        <span className={styles.historyItemDate}>
                          <time dateTime={version.creado_en}>{formatVersionDate(version.creado_en)}</time>
                        </span>
                      </summary>
                      <div className={styles.historyDetailsBody}>
                        <DefinicionView definicion={version.definicion} />
                      </div>
                    </details>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default IndicadorDetailPage;
