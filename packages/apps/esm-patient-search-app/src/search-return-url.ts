const trimTrailingSlash = (path: string) => path.replace(/\/+$/, '');

const getSpaBase = () => trimTrailingSlash(globalThis.spaBase ?? globalThis.getOpenmrsSpaBase?.() ?? '/openmrs/spa');

export const getPatientSearchFallbackUrl = () => `${getSpaBase()}/home/home`;

export const getPatientSearchReturnUrl = () => {
  const storedReturnUrl = globalThis.sessionStorage.getItem('searchReturnUrl');
  const spaBase = getSpaBase();

  if (
    storedReturnUrl &&
    storedReturnUrl !== spaBase &&
    storedReturnUrl !== `${spaBase}/` &&
    !storedReturnUrl.startsWith(`${spaBase}/search`)
  ) {
    return storedReturnUrl;
  }

  return getPatientSearchFallbackUrl();
};
