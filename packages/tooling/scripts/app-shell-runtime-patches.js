const extensionParcelTimeouts =
  'timeouts:{bootstrap:{millis:1e4,dieOnTimeout:!1,warningMillis:1e4},mount:{millis:1e4,dieOnTimeout:!1,warningMillis:1e4},update:{millis:1e4,dieOnTimeout:!1,warningMillis:1e4},unmount:{millis:1e4,dieOnTimeout:!1,warningMillis:1e4}}';

const userFacingErrorPatches = Object.freeze([
  Object.freeze({
    name: 'offline setup user-facing error',
    search: 'title:"Offline Setup Error",description:e.message',
    replacement:
      'title:document.documentElement.lang.toLowerCase().startsWith("es")?"Modo sin conexión no disponible":"Offline setup unavailable",description:document.documentElement.lang.toLowerCase().startsWith("es")?"No se pudo activar el modo sin conexión. Puede iniciar sesión y trabajar en línea. Si el problema continúa, contacte a soporte.":"Offline mode could not be enabled. You can still sign in and work online. If this continues, contact support."',
    required: true,
  }),
  Object.freeze({
    name: 'global unexpected error message',
    search: 'description:e??"Oops! An unexpected error occurred.",kind:"error",title:"Error"',
    replacement:
      'description:document.documentElement.lang.toLowerCase().startsWith("es")?"Ocurrió un error inesperado.":"An unexpected error occurred.",kind:"error",title:"Error"',
    required: true,
  }),
  Object.freeze({
    name: 'global rejected promise message',
    search: 'description:e.reason??"Oops! An unhandled promise rejection occurred.",kind:"error",title:"Error"',
    replacement:
      'description:document.documentElement.lang.toLowerCase().startsWith("es")?"Ocurrió un error inesperado.":"An unexpected error occurred.",kind:"error",title:"Error"',
    required: true,
  }),
  Object.freeze({
    name: 'fatal startup error message',
    search: 'r.textContent=(null==e?void 0:e.message)||"No additional information available."',
    replacement:
      'r.textContent=document.documentElement.lang.toLowerCase().startsWith("es")?"No se pudo iniciar la aplicación. Intente recargar la página o contacte a soporte.":"The application could not start. Try reloading the page or contact support."',
    required: true,
  }),
]);

const workspaceTranslationPatches = Object.freeze([
  Object.freeze({
    name: 'Spanish workspace close prompt translation',
    search:
      '"closeWorkspaces2PromptBody":"Está a punto de cerrar el/los siguiente/s espacio/s de trabajo, el/los cual/es puede/n tener cambios sin guardar:","closeWorkspaces2PromptTitle":"Close workspace(s)"',
    replacement:
      '"closeWorkspaces2PromptBody":"Está a punto de cerrar los siguientes espacios de trabajo, que podrían tener cambios sin guardar:","closeWorkspaces2PromptTitle":"Cerrar espacios de trabajo"',
    required: true,
  }),
]);

const appShellRuntimePatches = Object.freeze([...userFacingErrorPatches, ...workspaceTranslationPatches]);
const patchedAppShellSignatures = Object.freeze([
  extensionParcelTimeouts,
  ...new Set(appShellRuntimePatches.map(({ replacement }) => replacement)),
]);
const unpatchedAppShellSignatures = Object.freeze(appShellRuntimePatches.map(({ search }) => search));

function hasPatchedAppShellSignature(source) {
  return patchedAppShellSignatures.some((signature) => source.includes(signature));
}

function hasUnpatchedAppShellSignature(source) {
  return unpatchedAppShellSignatures.some((signature) => source.includes(signature));
}

module.exports = {
  appShellRuntimePatches,
  extensionParcelTimeouts,
  hasPatchedAppShellSignature,
  hasUnpatchedAppShellSignature,
  patchedAppShellSignatures,
  unpatchedAppShellSignatures,
  userFacingErrorPatches,
  workspaceTranslationPatches,
};
