import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export interface RecetaUnicaEmission {
  /** Correlativo emitido por la fuente idgen del servidor. */
  number: string;
  /** Instante de emisión según el reloj DEL SERVIDOR (cabecera Date de la respuesta). */
  issuedAt: string;
  /** Último día de vigencia impreso, derivado de issuedAt + validityDays. */
  validUntil: string;
}

/**
 * Emite el correlativo de la Receta Única desde la fuente idgen configurada.
 *
 * La numeración y su auditoría viven en el servidor: idgen registra cada
 * emisión (fecha, usuario y comentario) en su log, y la fecha impresa proviene
 * de la cabecera `Date` de la respuesta, no del reloj del navegador — las
 * laptops del hospital ya demostraron desviarse. Si el servidor no responde o
 * no entrega número, NO hay receta: el llamador debe abortar y conservar solo
 * la hoja informativa. Nunca degradar a numeración local.
 */
export async function generateRecetaUnicaNumber(
  identifierSourceUuid: string,
  auditComment: string,
  validityDays: number,
  signal?: AbortSignal,
): Promise<RecetaUnicaEmission> {
  const response = await openmrsFetch<{ identifier?: string }>(
    `${restBaseUrl}/idgen/identifiersource/${identifierSourceUuid}/identifier`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // idgen persiste el comentario en su log de emisión; si la versión
      // desplegada lo ignorase, el log conserva igualmente fecha y usuario.
      body: { comment: auditComment },
      signal,
    },
  );

  const number = response?.data?.identifier?.trim();
  if (!number) {
    throw new Error('La fuente de numeración no entregó un correlativo.');
  }

  const serverDateHeader = response.headers?.get?.('date');
  const issuedAtMs = serverDateHeader ? Date.parse(serverDateHeader) : Number.NaN;
  if (Number.isNaN(issuedAtMs)) {
    // Sin fecha del servidor no hay emisión auditable coherente con lo impreso.
    throw new Error('La respuesta del servidor no incluyó una fecha de emisión.');
  }

  const issuedAt = new Date(issuedAtMs).toISOString();
  const validUntil = new Date(issuedAtMs + validityDays * 24 * 60 * 60 * 1000).toISOString();
  return { number, issuedAt, validUntil };
}

/**
 * Número de colegiatura del prescriptor, leído del provider attribute
 * configurado. `null` deja el espacio para completarlo a mano: la firma y el
 * sello manuscritos siguen siendo lo que valida la receta.
 */
export async function fetchProviderCollegiateNumber(
  providerUuid: string,
  collegiateAttributeTypeUuid: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!providerUuid || !collegiateAttributeTypeUuid) {
    return null;
  }

  const { data } = await openmrsFetch<{
    attributes?: Array<{ voided?: boolean; value?: unknown; attributeType?: { uuid?: string } }>;
  }>(`${restBaseUrl}/provider/${providerUuid}?v=custom:(attributes:(voided,value,attributeType:(uuid)))`, { signal });

  const attribute = (data?.attributes ?? []).find(
    (candidate) => !candidate.voided && candidate.attributeType?.uuid === collegiateAttributeTypeUuid,
  );
  const value = attribute?.value;
  if (typeof value === 'string') {
    return value.trim() || null;
  }
  if (value && typeof value === 'object' && 'display' in value && typeof value.display === 'string') {
    return value.display.trim() || null;
  }
  return null;
}
