# esm-offline-tools-app

Microfrontend para preparar pacientes para uso sin conexión, revisar acciones pendientes de sincronización y controlar la entrada o salida del modo offline.

## Contrato RBAC actual

| Superficie                                          | Privilegio frontend                    |
| --------------------------------------------------- | -------------------------------------- |
| Página, menú de aplicación y opt-in de modo offline | `app:herramientasSinInternet`          |
| Widgets de acciones offline en la hoja clínica      | `app:hoja.clinica.accionesSinConexion` |

El componente raíz vuelve a comprobar `app:herramientasSinInternet`, de modo que ocultar el menú no es el único control frente a una URL directa.

El modal compartido de confirmación no tiene un privilegio de edición propio. En el contrato actual, eliminar acciones de sincronización pendientes o retirar pacientes de la lista offline queda bajo el privilegio de la superficie que inició la acción; `app:hoja.clinica.accionesSinConexion.editar` ya no es un guard ni tiene alias de compatibilidad.

Si se requiere separación entre lectura y eliminación, debe agregarse un privilegio de escritura a los controles y handlers que ejecutan la operación, además del modal y sus pruebas. Proteger solo el registro del modal no autoriza el borrado en backend ni en el almacenamiento local.

## Dependencia backend

El manifest requiere `webservices.rest >= 2.2.0`. El soporte sin conexión también depende del service worker, del almacenamiento local y de las capacidades offline habilitadas por el app shell.

## Synchronization failure contract

Queue synchronization is complete only when `runSynchronization` fulfills. A rejected synchronization keeps pending
items in the authenticated user's queue and is shown with a fixed, non-technical message; backend responses, URLs,
identifiers, and exception details must never be rendered. The page refreshes the queue after both completed and
incomplete attempts, and a refresh failure is handled separately instead of becoming an unhandled rejection.
Patient-list updates also settle both view refreshes. An update failure takes precedence; otherwise a refresh failure
shows one fixed stale-state warning without exposing the rejected value. Each merged view waits for all of its
constituent SWR refreshes and rejects with one fixed, non-technical error only after every child settles.

Patient synchronization succeeds only after the service worker accepts the patient route and a confirmed fresh
network response replaces the stable cache entry. A failed or canceled refresh preserves any previously cached
response and reports one fixed, non-sensitive failure; stale cache or locally queued data never count as a successful
refresh.

## Error and privacy contract

Synchronization details render a fixed translated message for failed handlers. Persisted `error.message` values are
never displayed because legacy IndexedDB records may contain URLs, UUIDs, or clinical data.

The worker now checks ownership before serving clinical downloads. Removing a patient from the offline list still
removes membership, not every cached response; use the verified cleanup action to remove downloaded copies. Continue
using a dedicated managed OS/browser profile per clinical user as required by the shared offline contract below.

## Preparation, errors and actions

The menu toggle enables offline use; it does not claim the device is prepared. The home card verifies selected
patient/form downloads and shows the oldest verified update, incomplete selections, storage reserve and persistence.
Only an explicit button requests persistent storage. Read failures and failed operations show fixed translated errors
with retry controls; missing patient metadata does not hide a pending action or leave an endless loading skeleton.

Actions are filtered and sorted across the complete owned collection before pagination. Page size is controlled, and
a shrinking queue clamps the active page. Selection and deletion use stable queue IDs. Sync errors are displayed as
an opaque status rather than persisted backend details.

Download cleanup requires confirmation, a fresh owned session and an empty queue; it preserves pending content and
selected membership. A partial failure remains blocked until verified retry. See the
[shared offline contract](../../libs/esm-offline/README.md#download-ownership-and-verified-cleanup).
