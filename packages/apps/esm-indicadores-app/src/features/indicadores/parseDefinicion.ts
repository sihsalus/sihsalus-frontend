import type { DefinicionIndicadorForm, DiagnosticoOption, IndicadorFormValues } from '../../api/types';

function toStringValue(value?: number) {
  return value === undefined ? '' : String(value);
}

/**
 * Pre-resolved uuid → display-name maps the form needs at mount time so the
 * event-filter pills show human-readable names instead of raw UUIDs. Each map
 * is optional; a missing entry falls back to the UUID itself (see
 * `parseDefinicion`).
 */
export interface DefinicionResolvableNames {
  locations?: Map<string, string>;
  diagnosticos?: Map<string, DiagnosticoOption>;
  ordenes?: Map<string, string>;
  encounterTypes?: Map<string, string>;
}

export function parseDefinicion(
  definicion?: DefinicionIndicadorForm,
  names?: DefinicionResolvableNames,
): Partial<IndicadorFormValues> {
  if (!definicion) {
    return {};
  }

  const diagnosticos = definicion.evento?.diagnosticos?.[0];
  const ordenUuids = definicion.evento?.ordenes?.map((orden) => orden.concepto_uuid) ?? [];
  const locationUuids = definicion.evento?.location_uuids ?? [];
  const encounterTypeUuids = definicion.evento?.encounter_type_uuids ?? [];
  const diagnosticoUuids = diagnosticos?.concepto_uuids ?? [];

  return {
    tipo: definicion.tipo,
    selectedLocations: locationUuids.map((uuid) => ({
      uuid,
      display: names?.locations?.get(uuid) ?? uuid,
    })),
    minimoOcurrencias: toStringValue(definicion.evento?.minimo_ocurrencias),
    filtroClinico: diagnosticoUuids.length ? 'diagnosticos' : ordenUuids.length ? 'ordenes' : 'ninguno',
    selectedDiagnosticos: diagnosticoUuids.map((uuid) => ({
      uuid,
      nombre: names?.diagnosticos?.get(uuid)?.nombre ?? uuid,
    })),
    diagnosticoTipo: diagnosticos?.tipo_diagnostico ?? '',
    selectedOrdenes: ordenUuids.map((uuid) => ({
      uuid,
      display: names?.ordenes?.get(uuid) ?? uuid,
    })),
    selectedEncounterTypes: encounterTypeUuids.map((uuid) => ({
      uuid,
      display: names?.encounterTypes?.get(uuid) ?? uuid,
    })),
    sexo: definicion.poblacion?.sexo ?? '',
    minAnios: toStringValue(definicion.poblacion?.min_anios),
    minMeses: toStringValue(definicion.poblacion?.min_meses),
    minDias: toStringValue(definicion.poblacion?.min_dias),
    maxAnios: toStringValue(definicion.poblacion?.max_anios_excl),
    maxMeses: toStringValue(definicion.poblacion?.max_meses_excl),
    maxDias: toStringValue(definicion.poblacion?.max_dias),
  };
}
