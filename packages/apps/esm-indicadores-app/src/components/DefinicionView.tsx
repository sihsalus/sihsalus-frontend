import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { DefinicionIndicadorForm, DiagnosticoOption } from '../api/types';
import {
  useResolvedDiagnosticos,
  useResolvedEncounterTypes,
  useResolvedLocations,
  useResolvedOrdenes,
} from '../features/indicadores/hooks';
import styles from '../indicators-dashboard.module.scss';

export interface ResolvedDefinitionNames {
  locationNames: Map<string, string>;
  diagnosticoNames: Map<string, DiagnosticoOption>;
  ordenNames: Map<string, string>;
  encounterTypeNames: Map<string, string>;
}

interface DefinicionViewProps {
  definicion: DefinicionIndicadorForm;
  /**
   * Pre-resolved uuid → name maps (e.g. provided by the detail page for all
   * version definitions at once). When present, no resolve hooks run and no
   * additional network requests are made for this view.
   */
  resolved?: ResolvedDefinitionNames;
}

const DefinicionView: React.FC<DefinicionViewProps> = ({ definicion, resolved }) => {
  const { t } = useTranslation();
  const formatAgeBound = (bound: 'min' | 'max') => {
    const population = definicion.poblacion;
    const values = [
      population?.[bound === 'min' ? 'min_anios' : 'max_anios_excl'] !== undefined
        ? `${population[bound === 'min' ? 'min_anios' : 'max_anios_excl']} ${t('ageYears', 'años')}`
        : null,
      population?.[bound === 'min' ? 'min_meses' : 'max_meses_excl'] !== undefined
        ? `${population[bound === 'min' ? 'min_meses' : 'max_meses_excl']} ${t('ageMonths', 'meses')}`
        : null,
      population?.[bound === 'min' ? 'min_dias' : 'max_dias'] !== undefined
        ? `${population[bound === 'min' ? 'min_dias' : 'max_dias']} ${t('ageDays', 'días')}`
        : null,
    ].filter(Boolean);

    return values.length ? values.join(', ') : '-';
  };
  const locationUuids = useMemo(() => definicion.evento?.location_uuids ?? [], [definicion.evento?.location_uuids]);
  const diagnosticoUuids = useMemo(
    () => definicion.evento?.diagnosticos?.flatMap((item) => item.concepto_uuids) ?? [],
    [definicion.evento?.diagnosticos],
  );
  const ordenUuids = useMemo(
    () => definicion.evento?.ordenes?.map((item) => item.concepto_uuid) ?? [],
    [definicion.evento?.ordenes],
  );
  const encounterTypeUuids = useMemo(
    () => definicion.evento?.encounter_type_uuids ?? [],
    [definicion.evento?.encounter_type_uuids],
  );

  // With pre-resolved maps the hooks receive an empty list, so their SWR
  // keys stay null and no requests are issued.
  const { displayMap } = useResolvedLocations(resolved ? [] : locationUuids);
  const { resolveMap } = useResolvedDiagnosticos(resolved ? [] : diagnosticoUuids);
  const { data: ordenesData } = useResolvedOrdenes(resolved ? [] : ordenUuids);
  const { displayMap: encounterTypesData } = useResolvedEncounterTypes(resolved ? [] : encounterTypeUuids);

  const locationNames = resolved?.locationNames ?? displayMap;
  const diagnosticoNames = resolved?.diagnosticoNames ?? resolveMap;
  // Order names arrive as a Record from the hook but as a Map when
  // pre-resolved; normalize to a Map so the render path is uniform.
  const ordenNames = useMemo(
    () => resolved?.ordenNames ?? (ordenesData ? new Map(Object.entries(ordenesData)) : new Map<string, string>()),
    [resolved, ordenesData],
  );
  const encounterTypeNames = resolved?.encounterTypeNames ?? encounterTypesData;

  const tipoLabel =
    definicion.tipo === 'conteo_atenciones'
      ? t('countEncounters', 'Conteo de atenciones')
      : definicion.tipo === 'conteo_pacientes_ventana'
        ? t('countPatientsWindow', 'Conteo de pacientes en ventana etaria')
        : t('countPatients', 'Conteo de pacientes');

  return (
    <div className={styles.definitionList}>
      <div>
        <strong>{t('definitionType', 'Tipo:')}</strong> {tipoLabel}
      </div>
      <div>
        <strong>{t('definitionLocations', 'Servicios:')}</strong>{' '}
        {locationUuids.length
          ? locationUuids.map((uuid) => locationNames.get(uuid) ?? uuid).join(', ')
          : t('all', 'Todos')}
      </div>
      <div>
        <strong>{t('definitionMinOccurrences', 'Mínimo de ocurrencias:')}</strong>{' '}
        {definicion.evento?.minimo_ocurrencias ?? 1}
      </div>
      <div>
        <strong>{t('definitionEncounterTypes', 'Tipos de encuentro:')}</strong>{' '}
        {encounterTypeUuids.length
          ? encounterTypeUuids.map((uuid) => encounterTypeNames.get(uuid) ?? uuid).join(', ')
          : t('noFilter', 'Sin filtro')}
      </div>
      <div>
        <strong>{t('definitionDiagnostics', 'Diagnósticos:')}</strong>{' '}
        {definicion.evento?.diagnosticos?.length
          ? definicion.evento.diagnosticos
              .map((item) => item.concepto_uuids.map((uuid) => diagnosticoNames.get(uuid)?.nombre ?? uuid).join(', '))
              .join(', ')
          : t('noFilter', 'Sin filtro')}
      </div>
      <div>
        <strong>{t('definitionOrders', 'Órdenes:')}</strong>{' '}
        {definicion.evento?.ordenes?.length
          ? definicion.evento.ordenes.map((item) => ordenNames.get(item.concepto_uuid) ?? item.concepto_uuid).join(', ')
          : t('noFilter', 'Sin filtro')}
      </div>
      <div>
        <strong>{t('definitionSex', 'Sexo:')}</strong> {definicion.poblacion?.sexo ?? t('noFilter', 'Sin filtro')}
      </div>
      <div>
        <strong>{t('definitionAge', 'Edad:')}</strong>{' '}
        {t('ageRangeValue', 'min {{min}} / max {{max}}', {
          min: formatAgeBound('min'),
          max: formatAgeBound('max'),
        })}
      </div>
    </div>
  );
};

export default DefinicionView;
