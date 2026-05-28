import type { DefinicionIndicadorForm, IndicadorFormValues } from '../../api/types';

function toCsv(values?: Array<string>) {
  return values?.join(', ') ?? '';
}

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
    locationUuids: toCsv(definicion.evento?.location_uuids),
    minimoOcurrencias: toStringValue(definicion.evento?.minimo_ocurrencias),
    filtroClinico: diagnosticos?.concepto_uuids?.length ? 'diagnosticos' : ordenes?.concepto_uuids?.length ? 'ordenes' : 'ninguno',
    diagnosticoUuids: toCsv(diagnosticos?.concepto_uuids),
    diagnosticoTipo: diagnosticos?.tipo_diagnostico ?? '',
    ordenUuids: toCsv(ordenes?.concepto_uuids),
    sexo: definicion.poblacion?.sexo ?? '',
    minAnios: toStringValue(definicion.poblacion?.min_anios),
    minMeses: toStringValue(definicion.poblacion?.min_meses),
    minDias: toStringValue(definicion.poblacion?.min_dias),
    maxAnios: toStringValue(definicion.poblacion?.max_anios_excl),
    maxMeses: toStringValue(definicion.poblacion?.max_meses_excl),
    maxDias: toStringValue(definicion.poblacion?.max_dias),
  };
}
