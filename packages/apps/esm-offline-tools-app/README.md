# esm-offline-tools-app

Microfrontend para preparar pacientes para uso sin conexión, revisar acciones pendientes de sincronización y controlar la entrada o salida del modo offline.

## Contrato RBAC actual

| Superficie | Privilegio frontend |
| --- | --- |
| Página, menú de aplicación y opt-in de modo offline | `app:herramientasSinInternet` |
| Widgets de acciones offline en la hoja clínica | `app:hoja.clinica.accionesSinConexion` |

El componente raíz vuelve a comprobar `app:herramientasSinInternet`, de modo que ocultar el menú no es el único control frente a una URL directa.

El modal compartido de confirmación no tiene un privilegio de edición propio. En el contrato actual, eliminar acciones de sincronización pendientes o retirar pacientes de la lista offline queda bajo el privilegio de la superficie que inició la acción; `app:hoja.clinica.accionesSinConexion.editar` ya no es un guard ni tiene alias de compatibilidad.

Si se requiere separación entre lectura y eliminación, debe agregarse un privilegio de escritura a los controles y handlers que ejecutan la operación, además del modal y sus pruebas. Proteger solo el registro del modal no autoriza el borrado en backend ni en el almacenamiento local.

## Dependencia backend

El manifest requiere `webservices.rest >= 2.2.0`. El soporte sin conexión también depende del service worker, del almacenamiento local y de las capacidades offline habilitadas por el app shell.
