import { getUserFacingErrorMessage } from '@openmrs/esm-framework';

type Translate = (key: string, defaultValue: string) => string;

export function indicatorsErrorMessageOptions(t: Translate) {
  return {
    logContext: 'Indicadores clínicos',
    statusMessages: {
      400: t('indicatorsError400', 'Los datos enviados no son válidos. Revise el formulario.'),
      401: t('indicatorsError401', 'Su sesión venció. Inicie sesión nuevamente.'),
      403: t('indicatorsError403', 'No tiene permiso para realizar esta operación.'),
      404: t('indicatorsError404', 'El registro solicitado ya no existe.'),
      409: t('indicatorsError409', 'El registro fue modificado por otra operación. Actualice e intente nuevamente.'),
      422: t('indicatorsError422', 'Los datos enviados no cumplen las reglas del indicador.'),
      500: t('indicatorsError500', 'El servicio de indicadores encontró un error. Intente nuevamente.'),
      502: t('indicatorsError502', 'El servicio de indicadores no está disponible en este momento.'),
      503: t('indicatorsError503', 'El servicio de indicadores no está disponible en este momento.'),
      504: t('indicatorsError504', 'El servicio de indicadores tardó demasiado en responder.'),
    },
  } as const;
}

interface UnknownEncounterTypesDetail {
  field: 'encounter_type_uuids';
  unknown_uuids: Array<string>;
}

function getUnknownEncounterTypesDetail(error: unknown): UnknownEncounterTypesDetail | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const responseBody = (error as { responseBody?: unknown }).responseBody;
  if (!responseBody || typeof responseBody !== 'object') {
    return undefined;
  }

  const detail = (responseBody as { detail?: unknown }).detail;
  if (!detail || typeof detail !== 'object') {
    return undefined;
  }

  const candidate = detail as { field?: unknown; unknown_uuids?: unknown };
  if (
    candidate.field !== 'encounter_type_uuids' ||
    !Array.isArray(candidate.unknown_uuids) ||
    candidate.unknown_uuids.length === 0
  ) {
    return undefined;
  }

  return { field: 'encounter_type_uuids', unknown_uuids: candidate.unknown_uuids as Array<string> };
}

/**
 * Message for indicator create/version failures. Surfaces the 422 validation
 * detail produced by reportes-sql when the submitted definition references
 * encounter types the backend cannot resolve; every other failure (including
 * the 502 gateway error) falls back to the standard status mapping.
 */
export function getIndicadorSaveErrorMessage(error: unknown, t: Translate, fallback: string): string {
  const detail = getUnknownEncounterTypesDetail(error);
  if (detail) {
    return t(
      'encounterTypesUnknownUuids',
      `Hay tipos de encuentro que no existen: ${detail.unknown_uuids.join(', ')}.`,
    );
  }

  return getUserFacingErrorMessage(error, fallback, indicatorsErrorMessageOptions(t));
}
