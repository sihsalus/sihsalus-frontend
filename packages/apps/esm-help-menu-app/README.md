# esm-help-menu-app

App transversal para el menú de ayuda y soporte.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo

- Ley N.° 29733, Ley de Protección de Datos Personales (Perú).

## Límites funcionales

- Muestra accesos de ayuda, documentación y enlaces de soporte.
- No administra datos clínicos ni flujos operativos del paciente.
- No sustituye la navegación principal del producto.
- Solo expone opciones de asistencia contextual y de usuario.

## Integraciones

- Configuración global de navegación y ayuda.
- Componentes de menú y rutas del shell del frontend.
- Enlaces externos o internos según configuración del despliegue. Las opciones
  `releaseNotesUrl`, `documentationUrl` y `supportUrl` apuntan por defecto al
  portal LAN `/ayuda/`; una URL vacía oculta el acceso correspondiente.
- Para evitar navegación a destinos no confiables, solo se aceptan rutas bajo
  `/ayuda/` o los portales HTTPS aprobados `docs.sihsalus.org` y
  `sihsalus.github.io/sihsalus-docs/`. Un valor inválido oculta el enlace.

## Despliegue seguro

- La copia LAN del portal debe estar disponible antes de activar estos enlaces.
- Los enlaces se abren en otra pestaña con aislamiento del contexto de la SPA.
- El portal no recibe datos clínicos ni parámetros del paciente.
- Una caída del portal de ayuda no debe impedir el uso de SIHSALUS.

## Tipado y validación

El código y las pruebas usan [TypeScript estricto](../../tooling/tsconfig.strict.json).
Desde la raíz, ejecutar `yarn workspace @sihsalus/esm-help-menu-app typescript`
y los scripts `lint`, `test` y `build` del mismo paquete. Las pruebas del menú
cubren el cierre al pulsar fuera con ratón o pantalla táctil y su permanencia
al pulsar dentro. Si desaparecen la sesión autenticada, el usuario o las opciones
de ayuda, el menú se cierra y permanece cerrado al recuperarse.
