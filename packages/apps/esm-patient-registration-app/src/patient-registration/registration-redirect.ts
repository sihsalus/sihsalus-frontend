import { interpolateUrl } from '@openmrs/esm-framework';

const openmrsSpaBaseTemplate = `\${openmrsSpaBase}`;
const patientUuidTemplate = `\${patientUuid}`;

function hasAllowedShape(candidate: string) {
  if (!candidate || candidate.includes('\\')) {
    return false;
  }

  const isSpaTemplatePath = candidate.startsWith(`${openmrsSpaBaseTemplate}/`);
  const isRootRelativePath = candidate.startsWith('/') && !candidate.startsWith('//');

  if (!isSpaTemplatePath && !isRootRelativePath) {
    return false;
  }

  const pathWithoutSpaTemplate = isSpaTemplatePath ? candidate.slice(openmrsSpaBaseTemplate.length) : candidate;

  if (pathWithoutSpaTemplate.startsWith('//') || pathWithoutSpaTemplate.includes(openmrsSpaBaseTemplate)) {
    return false;
  }

  return !pathWithoutSpaTemplate.replaceAll(patientUuidTemplate, '').includes('${');
}

/**
 * Resolves a registration return URL while limiting interpolation to the SPA base
 * and the newly saved patient UUID. Invalid or external targets are discarded.
 */
export function resolveRegistrationAfterUrl(rawAfterUrl: string | null, patientUuid: string): string | null {
  if (!rawAfterUrl || !hasAllowedShape(rawAfterUrl)) {
    return null;
  }

  const resolvedTarget = interpolateUrl(rawAfterUrl, {
    patientUuid: encodeURIComponent(patientUuid),
  });

  try {
    const targetUrl = new URL(resolvedTarget, globalThis.location.origin);
    const normalizedTarget = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;

    if (
      targetUrl.origin !== globalThis.location.origin ||
      !normalizedTarget.startsWith('/') ||
      normalizedTarget.startsWith('//')
    ) {
      return null;
    }

    return normalizedTarget;
  } catch {
    return null;
  }
}
