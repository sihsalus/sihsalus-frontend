import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import IndicadorForm from '../components/IndicadorForm';
import type { DefinicionIndicadorForm } from '../api/types';
import { useCreateIndicador, useIndicador, useUpdateIndicador, notifyError, notifySuccess } from '../features/indicadores/hooks';
import { parseDefinicion } from '../features/indicadores/parseDefinicion';
import styles from '../indicators-dashboard.module.scss';

interface IndicadorFormPageProps {
  mode: 'create' | 'edit';
}

const IndicadorFormPage: React.FC<IndicadorFormPageProps> = ({ mode }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const { createIndicador } = useCreateIndicador();
  const { updateIndicador } = useUpdateIndicador();
  const { data: indicador, isLoading, error } = useIndicador(mode === 'edit' ? id ?? '' : '');

  const defaultValues = useMemo(() => {
    if (!indicador?.versiones.length) {
      return undefined;
    }

    return {
      nombre: indicador.nombre,
      descripcion: indicador.descripcion ?? '',
      ...parseDefinicion(indicador.versiones[0].definicion),
    };
  }, [indicador]);

  const handleSubmit = async ({ metadata, definicion }: { metadata: { nombre: string; descripcion: string | null }; definicion?: DefinicionIndicadorForm }) => {
    setServerError(null);

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
      const message = submitError instanceof Error ? submitError.message : 'No se pudo guardar el indicador';
      setServerError(message);
      notifyError(message);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <Link to="/" className={styles.inlineLink}>Volver al listado</Link>
          <h2>{mode === 'create' ? 'Nuevo indicador' : 'Editar indicador'}</h2>
        </div>
      </div>

      {mode === 'edit' && isLoading ? <p>Cargando indicador...</p> : null}
      {mode === 'edit' && error ? <div className={styles.errorBanner}>{error.message}</div> : null}
      {mode === 'edit' && !indicador && !isLoading && !error ? <div className={styles.errorBanner}>No se encontró el indicador.</div> : null}

      {mode === 'create' || indicador ? (
        <IndicadorForm
          mode={mode}
          defaultValues={defaultValues}
          initialMetadata={indicador ? { nombre: indicador.nombre, descripcion: indicador.descripcion } : undefined}
          serverError={serverError}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
};

export default IndicadorFormPage;
