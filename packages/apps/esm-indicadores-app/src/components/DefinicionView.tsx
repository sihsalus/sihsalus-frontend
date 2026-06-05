import React, { useMemo } from 'react';

import type { DefinicionIndicadorForm } from '../api/types';
import { useResolvedDiagnosticos, useResolvedLocations } from '../features/indicadores/hooks';
import styles from '../indicators-dashboard.module.scss';

interface DefinicionViewProps {
  definicion: DefinicionIndicadorForm;
}

const tipoLabels = {
  conteo_atenciones: 'Conteo de atenciones',
  conteo_pacientes: 'Conteo de pacientes',
};

const periodoLabels = {
  mes_actual: 'Mes actual',
  trimestre_actual: 'Trimestre actual',
  semestre_actual: 'Semestre actual',
  anual_actual: 'Año actual',
};

const DefinicionView: React.FC<DefinicionViewProps> = ({ definicion }) => {
  const locationUuids = useMemo(() => definicion.evento?.location_uuids ?? [], [definicion.evento?.location_uuids]);
  const diagnosticoUuids = useMemo(
    () => definicion.evento?.diagnosticos?.flatMap((item) => item.concepto_uuids) ?? [],
    [definicion.evento?.diagnosticos],
  );

  const { displayMap } = useResolvedLocations(locationUuids);
  const { resolveMap } = useResolvedDiagnosticos(diagnosticoUuids);

  return (
    <div className={styles.definitionList}>
      <div>
        <strong>Tipo:</strong> {tipoLabels[definicion.tipo]}
      </div>
      <div>
        <strong>Periodo:</strong> {periodoLabels[definicion.periodo]}
      </div>
      <div>
        <strong>Servicios:</strong>{' '}
        {locationUuids.length ? locationUuids.map((uuid) => displayMap.get(uuid) ?? uuid).join(', ') : 'Todos'}
      </div>
      <div>
        <strong>Mínimo de ocurrencias:</strong> {definicion.evento?.minimo_ocurrencias ?? 1}
      </div>
      <div>
        <strong>Diagnósticos:</strong>{' '}
        {definicion.evento?.diagnosticos?.length
          ? definicion.evento.diagnosticos
              .map((item) => item.concepto_uuids.map((uuid) => resolveMap.get(uuid)?.nombre ?? uuid).join(', '))
              .join(' | ')
          : 'Sin filtro'}
      </div>
      <div>
        <strong>Órdenes:</strong>{' '}
        {definicion.evento?.ordenes?.length
          ? definicion.evento.ordenes.map((item) => item.concepto_uuids.join(', ')).join(' | ')
          : 'Sin filtro'}
      </div>
      <div>
        <strong>Sexo:</strong> {definicion.poblacion?.sexo ?? 'Sin filtro'}
      </div>
      <div>
        <strong>Edad:</strong> min {definicion.poblacion?.min_anios ?? '-'} años / max{' '}
        {definicion.poblacion?.max_anios_excl ?? '-'} años
      </div>
    </div>
  );
};

export default DefinicionView;
