import type { DefinicionIndicadorForm, IndicadorFormValues } from '../../api/types';

function toStringValue(value?: number) {
  return value === undefined ? '' : String(value);
}

export function parseDefinicion(
  definicion?: DefinicionIndicadorForm,
  ordenesMap?: Record<string, string>,
): Partial<IndicadorFormValues> {
  if (!definicion) {
    return {};
  }

  const diagnosticos = definicion.evento?.diagnosticos?.[0];
  const ordenUuids = definicion.evento?.ordenes?.map((orden) => orden.concepto_uuid) ?? [];

  return {
    tipo: definicion.tipo,
    selectedLocations: (definicion.evento?.location_uuids ?? []).map((uuid) => ({ uuid, display: uuid })),
    minimoOcurrencias: toStringValue(definicion.evento?.minimo_ocurrencias),
    filtroClinico: diagnosticos?.concepto_uuids?.length ? 'diagnosticos' : ordenUuids.length ? 'ordenes' : 'ninguno',
    selectedDiagnosticos: (diagnosticos?.concepto_uuids ?? []).map((uuid) => ({ uuid, nombre: uuid })),
    diagnosticoTipo: diagnosticos?.tipo_diagnostico ?? '',
    selectedOrdenes: ordenUuids.map((uuid) => ({ uuid, display: ordenesMap?.[uuid] ?? uuid })),
    sexo: definicion.poblacion?.sexo ?? '',
    minAnios: toStringValue(definicion.poblacion?.min_anios),
    minMeses: toStringValue(definicion.poblacion?.min_meses),
    minDias: toStringValue(definicion.poblacion?.min_dias),
    maxAnios: toStringValue(definicion.poblacion?.max_anios_excl),
    maxMeses: toStringValue(definicion.poblacion?.max_meses_excl),
    maxDias: toStringValue(definicion.poblacion?.max_dias),
  };
}
