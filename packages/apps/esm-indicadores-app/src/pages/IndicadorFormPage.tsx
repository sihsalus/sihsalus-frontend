import { InlineLoading } from '@carbon/react';
import { getUserFacingErrorMessage } from '@openmrs/esm-framework';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { DefinicionIndicadorForm } from '../api/types';
import IndicadorForm from '../components/IndicadorForm';
import { indicatorsErrorMessageOptions, getIndicadorSaveErrorMessage } from '../features/indicadores/error-handling';
import {
  notifyError,
  notifySuccess,
  useCreateIndicador,
  useIndicador,
  useResolvedDiagnosticos,
  useResolvedEncounterTypes,
  useResolvedLocations,
  useResolvedOrdenes,
  useUpdateIndicador,
} from '../features/indicadores/hooks';
import { parseDefinicion } from '../features/indicadores/parseDefinicion';
import styles from '../indicators-dashboard.module.scss';

interface IndicadorFormPageProps {
  mode: 'create' | 'edit';
}

const IndicadorFormPage: React.FC<IndicadorFormPageProps> = ({ mode }) => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const { createIndicador } = useCreateIndicador();
  const { updateIndicador } = useUpdateIndicador();
  const { data: indicador, isLoading, error } = useIndicador(mode === 'edit' ? (id ?? '') : '');

  const firstVersion = indicador?.versiones?.[0]?.definicion;

  const ordenUuids = useMemo(
    () => firstVersion?.evento?.ordenes?.map((item) => item.concepto_uuid) ?? [],
    [firstVersion],
  );
  const locationUuids = useMemo(() => firstVersion?.evento?.location_uuids ?? [], [firstVersion]);
  const diagnosticoUuids = useMemo(
    () => firstVersion?.evento?.diagnosticos?.flatMap((item) => item.concepto_uuids) ?? [],
    [firstVersion],
  );
  const encounterTypeUuids = useMemo(() => firstVersion?.evento?.encounter_type_uuids ?? [], [firstVersion]);

  // Resolve every clinical-filter uuid to its display name BEFORE mounting the
  // form. The form state freezes at first mount (useState initializer), so the
  // pills would otherwise render raw UUIDs and never refresh. SWR isLoading
  // is true only on the first fetch without data; on error it goes false and
  // parseDefinicion falls back to the raw UUID (graceful degrade).
  const { displayMap: locationsMap, isLoading: locationsLoading } = useResolvedLocations(locationUuids);
  const { resolveMap: diagnosticosMap, isLoading: diagnosticosLoading } = useResolvedDiagnosticos(diagnosticoUuids);
  const { data: ordenesData, isLoading: ordenesLoading } = useResolvedOrdenes(ordenUuids);
  const ordenesMap = useMemo(() => (ordenesData ? new Map(Object.entries(ordenesData)) : undefined), [ordenesData]);
  const { displayMap: encounterTypesMap, isLoading: encounterTypesLoading } =
    useResolvedEncounterTypes(encounterTypeUuids);

  // Mount the form only once every async name resolution it needs is available
  // (or there is nothing to resolve). parseDefinicion falls back to raw UUIDs
  // when a name is missing, and the form state freezes at first mount.
  const locationsReady = locationUuids.length === 0 || !locationsLoading;
  const diagnosticosReady = diagnosticoUuids.length === 0 || !diagnosticosLoading;
  const ordenesReady = ordenUuids.length === 0 || !ordenesLoading;
  const encounterTypesReady = encounterTypeUuids.length === 0 || !encounterTypesLoading;
  const namesReady = locationsReady && diagnosticosReady && ordenesReady && encounterTypesReady;

  const defaultValues = useMemo(() => {
    if (!indicador?.versiones.length) {
      return undefined;
    }

    return {
      nombre: indicador.nombre,
      descripcion: indicador.descripcion ?? '',
      ...parseDefinicion(indicador.versiones[0].definicion, {
        locations: locationsMap,
        diagnosticos: diagnosticosMap,
        ordenes: ordenesMap,
        encounterTypes: encounterTypesMap,
      }),
    };
  }, [indicador, locationsMap, diagnosticosMap, ordenesMap, encounterTypesMap]);

  const handleSubmit = async ({
    metadata,
    definicion,
  }: {
    metadata: { nombre: string; descripcion: string | null };
    definicion?: DefinicionIndicadorForm;
  }) => {
    if (submittingRef.current) {
      return;
    }
    submittingRef.current = true;
    setServerError(null);
    setSubmitting(true);

    try {
      if (mode === 'create') {
        if (!definicion) {
          throw new Error(t('definitionRequiredCreate', 'La definición es obligatoria para crear un indicador.'));
        }
        const created = await createIndicador({ ...metadata, definicion });
        notifySuccess(t('indicatorCreated', 'Indicador creado'));
        navigate(`/${created.id}`);
      } else if (id) {
        await updateIndicador(id, metadata);
        notifySuccess(t('indicatorUpdated', 'Indicador actualizado'));
        navigate(`/${id}`);
      }
    } catch (submitError) {
      const message = getIndicadorSaveErrorMessage(
        submitError,
        t,
        t('indicatorSaveFailed', 'No se pudo guardar el indicador.'),
      );
      setServerError(message);
      notifyError(message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Link to="/" className={styles.backLink}>
            {t('backToIndicators', 'Volver a indicadores')}
          </Link>
          <h2>{mode === 'create' ? t('newIndicator', 'Nuevo indicador') : t('editIndicator', 'Editar indicador')}</h2>
        </div>
      </div>

      {mode === 'edit' && isLoading ? <p>{t('loadingIndicator', 'Cargando indicador...')}</p> : null}
      {mode === 'edit' && error ? (
        <div className={styles.errorBanner}>
          {getUserFacingErrorMessage(
            error,
            t('indicatorLoadFailed', 'No se pudo cargar el indicador.'),
            indicatorsErrorMessageOptions(t),
          )}
        </div>
      ) : null}
      {mode === 'edit' && !indicador && !isLoading && !error ? (
        <div className={styles.errorBanner}>{t('indicatorNotFound', 'No se encontró el indicador.')}</div>
      ) : null}

      {mode === 'edit' && indicador && !namesReady ? (
        <InlineLoading description={t('loadingNames', 'Cargando nombres clínicos...')} />
      ) : null}

      {mode === 'create' || (indicador && namesReady) ? (
        <div className={styles.formPageShell}>
          <div className={styles.formPageIntro}>
            <p className={styles.subtitle}>
              {mode === 'create'
                ? t(
                    'createModeIntro',
                    'Defina la metadata y la lógica base del indicador. Más adelante podemos reemplazar estos campos por selectores clínicos más ricos.',
                  )
                : t(
                    'editModeIntro',
                    'Actualice el nombre y la descripción. La definición de cálculo se versiona desde el detalle del indicador.',
                  )}
            </p>
          </div>
          <IndicadorForm
            mode={mode}
            defaultValues={defaultValues}
            initialMetadata={indicador ? { nombre: indicador.nombre, descripcion: indicador.descripcion } : undefined}
            serverError={serverError}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
          />
        </div>
      ) : null}
    </div>
  );
};

export default IndicadorFormPage;
