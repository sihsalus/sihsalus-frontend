import { useEffect } from 'react';

import { careLogbookBasePath, legacyAdmissionBasePath, legacyHomeAdmissionBasePath } from './constants';

export function getCareLogbookRedirectTarget(
  pathname = globalThis.location.pathname,
  search = globalThis.location.search,
  hash = globalThis.location.hash,
) {
  const spaBasePath = globalThis.getOpenmrsSpaBase().slice(0, -1);
  const legacyPaths = [`${spaBasePath}${legacyAdmissionBasePath}`, `${spaBasePath}${legacyHomeAdmissionBasePath}`];
  const matchedLegacyPath = legacyPaths.find(
    (legacyPath) => pathname === legacyPath || pathname.startsWith(`${legacyPath}/`),
  );
  const suffix = matchedLegacyPath ? pathname.slice(matchedLegacyPath.length) : '';

  return `${spaBasePath}${careLogbookBasePath}${suffix}${search}${hash}`;
}

export default function LegacyAdmissionRedirect() {
  useEffect(() => {
    globalThis.history.replaceState(globalThis.history.state, '', getCareLogbookRedirectTarget());
  }, []);

  return null;
}
