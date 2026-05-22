import type {} from '@openmrs/esm-globals';

const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function isDevEnabled() {
  return (
    window.spaEnv === 'development' ||
    (LOCAL_DEV_HOSTS.has(window.location.hostname) && localStorage.getItem('openmrs:devtools') === 'true')
  );
}
