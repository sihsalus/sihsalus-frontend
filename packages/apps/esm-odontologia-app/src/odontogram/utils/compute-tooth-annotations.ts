/**
 * Computes auto-generated annotations for a tooth based on its findings.
 *
 * Rules:
 * - abreviaturaSource === "none" → no annotation
 * - abreviaturaSource === "identificador" → use config.identificador
 * - abreviaturaSource === "tipo" → use the suboption's nombre
 *
 * Deduplication: if a finding appears multiple times (e.g. multiple designs),
 * only one annotation is generated per unique (findingId, text) pair.
 *
 * Color: taken from the finding's applied color.
 */

import type { FindingOptionConfig, ToothAnnotation, ToothFinding } from '../types/odontogram';

/**
 * Recompute annotations for a tooth given its current findings array
 * and the finding options catalog.
 */
export function computeToothAnnotations(
  findings: ToothFinding[],
  findingOptions: FindingOptionConfig[],
): ToothAnnotation[] {
  const annotations: ToothAnnotation[] = [];
  /** Track (findingId, text) to avoid duplicates from multi-design findings */
  const seen = new Set<string>();

  for (const finding of findings) {
    const cfg = findingOptions.find((o) => o.id === finding.findingId);
    if (!cfg) continue;

    const source = cfg.abreviaturaSource ?? 'none';
    if (source === 'none') continue;

    let text: string | undefined;

    if (source === 'identificador') {
      text = cfg.identificador;
    } else if (source === 'tipo') {
      // Look up the suboption nombre from the finding's subOptionId
      if (finding.subOptionId != null && cfg.subopciones) {
        const sub = cfg.subopciones.find((s) => s.id === finding.subOptionId);
        text = sub?.nombre;
      }
    }

    if (!text) continue;

    const key = `${finding.findingId}:${text}`;
    if (seen.has(key)) continue;
    seen.add(key);

    annotations.push({
      findingId: finding.findingId,
      text,
      color: finding.color.name,
    });
  }

  return annotations;
}
