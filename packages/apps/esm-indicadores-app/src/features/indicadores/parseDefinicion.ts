import type { DefinicionIndicadorForm, IndicadorFormValues } from '../../api/types';

function toStringValue(value?: number) {
  return value === undefined ? '' : String(value);
}

export function parseDefinicion(definicion?: DefinicionIndicadorForm): Partial<IndicadorFormValues> {
  if (!definicion) {
    return {};
  }

  const diagnosticos = definicion.evento?.diagnosticos?.[0];
  const ordenes = definicion.evento?.ordenes?.[0];

  return {
    tipo: definicion.tipo,
    periodo: definicion.periodo,
    selectedLocations: (definicion.evento?.location_uuids ?? []).map((uuid) => ({ uuid, display: uuid })),
    minimoOcurrencias: toStringValue(definicion.evento?.minimo_ocurrencias),
    filtroClinico: diagnosticos?.concepto_uuids?.length ? 'diagnosticos' : ordenes?.concepto_uuids?.length ? 'ordenes' : 'ninguno',
    selectedDiagnosticos: (diagnosticos?.concepto_uuids ?? []).map((uuid) => ({ uuid, nombre: uuid })),
    diagnosticoTipo: diagnosticos?.tipo_diagnostico ?? '',
    selectedOrdenes: (ordenes?.concepto_uuids ?? []).map((uuid) => ({ uuid, display: uuid })),
    sexo: definicion.poblacion?.sexo ?? '',
    minAnios: toStringValue(definicion.poblacion?.min_anios),
    minMeses: toStringValue(definicion.poblacion?.min_meses),
    minDias: toStringValue(definicion.poblacion?.min_dias),
    maxAnios: toStringValue(definicion.poblacion?.max_anios_excl),
    maxMeses: toStringValue(definicion.poblacion?.max_meses_excl),
    maxDias: toStringValue(definicion.poblacion?.max_dias),
  };
}
