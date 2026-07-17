import { getUserFacingErrorMessage } from '@openmrs/esm-framework';
import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { DefinicionIndicadorForm } from '../api/types';
import IndicadorForm from '../components/IndicadorForm';
import { indicatorsErrorMessageOptions } from '../features/indicadores/error-handling';
import {
  notifyError,
  notifySuccess,
  useCreateIndicador,
  useIndicador,
  useResolvedOrdenes,
  useUpdateIndicador,
} from '../features/indicadores/hooks';
import { parseDefinicion } from '../features/indicadores/parseDefinicion';
import styles from '../indicators-dashboard.module.scss';

interface IndicadorFormPageProps {
  mode: 'create' | 'edit';
}

const IndicadorFormPage: React.FC<IndicadorFormPageProps> = ({ mode }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const { createIndicador } = useCreateIndicador();
  const { updateIndicador } = useUpdateIndicador();
  const { data: indicador, isLoading, error } = useIndicador(mode === 'edit' ? (id ?? '') : '');

  const ordenUuids = useMemo(() => {
    if (!indicador?.versiones.length) {
      return [];
    }
    return indicador.versiones[0].definicion.evento?.ordenes?.map((item) => item.concepto_uuid) ?? [];
  }, [indicador]);

  const { data: ordenesData } = useResolvedOrdenes(ordenUuids);

  const defaultValues = useMemo(() => {
    if (!indicador?.versiones.length) {
      return undefined;
    }

    return {
      nombre: indicador.nombre,
      descripcion: indicador.descripcion ?? '',
      ...parseDefinicion(indicador.versiones[0].definicion, ordenesData),
    };
  }, [indicador, ordenesData]);

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
          throw new Error('La definición es obligatoria para crear un indicador.');
        }
        const created = await createIndicador({ ...metadata, definicion });
        notifySuccess('Indicador creado');
        navigate(`/${created.id}`);
      } else if (id) {
        await updateIndicador(id, metadata);
        notifySuccess('Indicador actualizado');
        navigate(`/${id}`);
      }
    } catch (submitError) {
      const message = getUserFacingErrorMessage(
        submitError,
        'No se pudo guardar el indicador.',
        indicatorsErrorMessageOptions,
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
            Volver a indicadores
          </Link>
          <h2>{mode === 'create' ? 'Nuevo indicador' : 'Editar indicador'}</h2>
        </div>
      </div>

      {mode === 'edit' && isLoading ? <p>Cargando indicador...</p> : null}
      {mode === 'edit' && error ? (
        <div className={styles.errorBanner}>
          {getUserFacingErrorMessage(error, 'No se pudo cargar el indicador.', indicatorsErrorMessageOptions)}
        </div>
      ) : null}
      {mode === 'edit' && !indicador && !isLoading && !error ? (
        <div className={styles.errorBanner}>No se encontró el indicador.</div>
      ) : null}

      {mode === 'create' || indicador ? (
        <div className={styles.formPageShell}>
          <div className={styles.formPageIntro}>
            <p className={styles.subtitle}>
              {mode === 'create'
                ? 'Definí la metadata y la lógica base del indicador. Más adelante podemos reemplazar estos campos por selectores clínicos más ricos.'
                : 'Actualizá el nombre y la descripción. La definición de cálculo se versiona desde el detalle del indicador.'}
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
