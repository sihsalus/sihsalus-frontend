const trimTrailingSlash = (path: string) => path.replace(/\/+$/, '');

const getSpaBase = () => trimTrailingSlash(globalThis.getOpenmrsSpaBase?.() ?? globalThis.spaBase ?? '/openmrs/spa');

export const getPatientSearchFallbackUrl = () => `${getSpaBase()}/home`;

export const getPatientSearchReturnUrl = () => {
  const storedReturnUrl = globalThis.sessionStorage.getItem('searchReturnUrl');
  const spaBase = getSpaBase();

  if (
    storedReturnUrl &&
    storedReturnUrl !== spaBase &&
    storedReturnUrl !== `${spaBase}/` &&
    storedReturnUrl !== `${spaBase}/home/home` &&
    !storedReturnUrl.startsWith(`${spaBase}/search`)
  ) {
    return storedReturnUrl;
  }

  return getPatientSearchFallbackUrl();
};
