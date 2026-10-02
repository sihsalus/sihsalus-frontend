import { Button, InlineLoading, Tag, Tile } from '@carbon/react';
import { formatDate, getUserFacingErrorMessage, parseDate } from '@openmrs/esm-framework';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { DefinicionIndicadorForm } from '../api/types';
import DefinicionView from '../components/DefinicionView';
import IndicadorForm from '../components/IndicadorForm';
import SQLPreviewSection from '../components/SQLPreviewSection';
import { getIndicadorSaveErrorMessage, indicatorsErrorMessageOptions } from '../features/indicadores/error-handling';
import {
  notifyError,
  notifySuccess,
  useCreateVersion,
  useIndicador,
  useResolvedDiagnosticos,
  useResolvedEncounterTypes,
  useResolvedLocations,
  useResolvedOrdenes,
} from '../features/indicadores/hooks';
import { parseDefinicion, type DefinicionResolvableNames } from '../features/indicadores/parseDefinicion';
import styles from '../indicators-dashboard.module.scss';
import type { ResolvedDefinitionNames } from '../components/DefinicionView';

const formatVersionDate = (iso: string) => formatDate(parseDate(iso));

const IndicadorDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [isSubmittingVersion, setSubmittingVersion] = useState(false);
  const submittingVersionRef = useRef(false);
  const { data, isLoading, error } = useIndicador(id);
  const { createVersion } = useCreateVersion(id);

  const latestVersion = useMemo(() => {
    // `Array.prototype.reduce` with no initial value throws `TypeError` on an
    // empty array, and `data.versiones[0]` would be `undefined`. Guard the
    // empty/absent case and return `undefined` — the render at L177 already
    // treats a falsy `latestVersion` as "no current definition".
    if (!data?.versiones.length) {
      return undefined;
    }
    return data.versiones.reduce((max, version) => (version.version > max.version ? version : max), data.versiones[0]);
  }, [data]);

  const ordenUuids = useMemo(() => {
    if (!latestVersion) {
      return [];
    }
    return latestVersion.definicion.evento?.ordenes?.map((item) => item.concepto_uuid) ?? [];
  }, [latestVersion]);

  const latestLocationUuids = useMemo(() => latestVersion?.definicion.evento?.location_uuids ?? [], [latestVersion]);
  const latestDiagnosticoUuids = useMemo(
    () => latestVersion?.definicion.evento?.diagnosticos?.flatMap((item) => item.concepto_uuids) ?? [],
    [latestVersion],
  );

  const { data: ordenesData, isLoading: ordenesLoading } = useResolvedOrdenes(ordenUuids);

  // Resolve names for EVERY version definition once, at page level, instead
  // of letting each DefinicionView fire its own resolve requests (N×3
  // fetches for N versions). SWR dedupes only identical keys, so distinct
  // uuid subsets still produce distinct network calls.
  const allLocationUuids = useMemo(
    () => Array.from(new Set(data?.versiones.flatMap((v) => v.definicion.evento?.location_uuids ?? []) ?? [])),
    [data],
  );
  const allDiagnosticoUuids = useMemo(
    () =>
      Array.from(
        new Set(
          data?.versiones.flatMap((v) => v.definicion.evento?.diagnosticos?.flatMap((d) => d.concepto_uuids) ?? []) ??
            [],
        ),
      ),
    [data],
  );
  const allOrdenUuids = useMemo(
    () =>
      Array.from(
        new Set(data?.versiones.flatMap((v) => v.definicion.evento?.ordenes?.map((o) => o.concepto_uuid) ?? []) ?? []),
      ),
    [data],
  );
  const allEncounterTypeUuids = useMemo(
    () => Array.from(new Set(data?.versiones.flatMap((v) => v.definicion.evento?.encounter_type_uuids ?? []) ?? [])),
    [data],
  );

  const { displayMap: locationNames, isLoading: locationNamesLoading } = useResolvedLocations(allLocationUuids);
  const { resolveMap: diagnosticoNames, isLoading: diagnosticoNamesLoading } =
    useResolvedDiagnosticos(allDiagnosticoUuids);
  const { displayMap: ordenNames, isLoading: ordenNamesLoading } = useResolvedOrdenes(allOrdenUuids);
  const { displayMap: encounterTypeNames, isLoading: encounterTypeNamesLoading } =
    useResolvedEncounterTypes(allEncounterTypeUuids);

  const formNames: DefinicionResolvableNames = useMemo(
    () => ({
      locations: locationNames,
      diagnosticos: diagnosticoNames,
      ordenes: ordenNames,
      encounterTypes: encounterTypeNames,
    }),
    [locationNames, diagnosticoNames, ordenNames, encounterTypeNames],
  );

  const resolved: ResolvedDefinitionNames = useMemo(
    () => ({ locationNames, diagnosticoNames, ordenNames, encounterTypeNames }),
    [locationNames, diagnosticoNames, ordenNames, encounterTypeNames],
  );

  const ordenesReady = ordenUuids.length === 0 || (!ordenesLoading && Boolean(ordenesData));
  const formNamesReady =
    (latestLocationUuids.length === 0 || !locationNamesLoading) &&
    (latestDiagnosticoUuids.length === 0 || !diagnosticoNamesLoading) &&
    (ordenUuids.length === 0 || !ordenNamesLoading) &&
    (allEncounterTypeUuids.length === 0 || !encounterTypeNamesLoading);

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
      notifySuccess(t('versionCreated', 'Versión creada'));
    } catch (createError) {
      const message = getIndicadorSaveErrorMessage(
        createError,
        t,
        t('versionCreateFailed', 'No se pudo crear la versión.'),
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
        {t('backToIndicators', 'Volver a indicadores')}
      </Link>

      {isLoading ? <p>{t('loadingIndicator', 'Cargando indicador...')}</p> : null}
      {error ? (
        <div className={styles.errorBanner}>
          {getUserFacingErrorMessage(
            error,
            t('indicatorLoadFailed', 'No se pudo cargar el indicador.'),
            indicatorsErrorMessageOptions(t),
          )}
        </div>
      ) : null}

      {data ? (
        <div className={styles.detailLayout}>
          <Tile className={styles.detailCard}>
            <div className={styles.header}>
              <div>
                <h2>{data.nombre}</h2>
                <p className={styles.subtitle}>{data.descripcion ?? t('noDescription', 'Sin descripción')}</p>
              </div>
              <Tag type={data.activo ? 'green' : 'gray'}>
                {data.activo ? t('active', 'Activo') : t('inactive', 'Inactivo')}
              </Tag>
            </div>
            <div className={styles.headerActions}>
              <Button size="sm" onClick={() => navigate(`/${data.id}/edit`)}>
                {t('editMetadata', 'Editar metadata')}
              </Button>
              <Button size="sm" kind="secondary" onClick={() => setShowVersionForm((value) => !value)}>
                {showVersionForm ? t('cancelNewVersion', 'Cancelar nueva versión') : t('newVersion', 'Nueva versión')}
              </Button>
            </div>
          </Tile>

          {showVersionForm ? (
            <Tile className={styles.section}>
              <h3 className={styles.sectionTitle}>{t('createNewVersion', 'Crear nueva versión')}</h3>
              {ordenesReady && formNamesReady ? (
                <IndicadorForm
                  mode="version"
                  defaultValues={latestVersion ? parseDefinicion(latestVersion.definicion, formNames) : undefined}
                  initialMetadata={{ nombre: data.nombre, descripcion: data.descripcion }}
                  serverError={serverError}
                  isSubmitting={isSubmittingVersion}
                  onSubmit={handleCreateVersion}
                />
              ) : (
                <InlineLoading
                  description={t(
                    ordenesReady ? 'loadingNames' : 'loadingOrders',
                    ordenesReady ? 'Cargando nombres clínicos...' : 'Cargando órdenes...',
                  )}
                />
              )}
            </Tile>
          ) : null}

          <div className={styles.detailGrid}>
            <div className={styles.detailMain}>
              {latestVersion ? (
                <Tile className={styles.detailCard}>
                  <h3 className={styles.sectionTitle}>{t('currentDefinition', 'Definición actual')}</h3>
                  <div className={styles.versionMeta}>
                    <span>
                      {t('versionLabel', 'Versión:')} #{latestVersion.version}
                    </span>
                    <span>
                      {t('createdLabel', 'Creado:')} {formatVersionDate(latestVersion.creado_en)}
                    </span>
                  </div>
                  <DefinicionView definicion={latestVersion.definicion} resolved={resolved} />
                  <SQLPreviewSection
                    indicadorId={data.id}
                    versionId={latestVersion.id}
                    versionNum={latestVersion.version}
                  />
                </Tile>
              ) : null}
            </div>

            <aside className={styles.detailAside}>
              <h3 className={styles.sectionTitle}>{t('versionHistory', 'Historial de versiones')}</h3>
              <ol className={styles.historyList} aria-label={t('versionHistoryAria', 'Versiones del indicador')}>
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
                        <DefinicionView definicion={version.definicion} resolved={resolved} />
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
