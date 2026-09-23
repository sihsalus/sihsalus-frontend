# esm-odontologia-app

Este microfrontend vive en la carpeta `packages/apps/esm-odontologia-app` y se publica como `@sihsalus/esm-odontologia-app`.

App para el registro y consulta odontológica.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo

- Ley N.° 26842, Ley General de Salud (Perú).

## Límites funcionales

- Permite visualizar, editar y guardar el estado odontológico durante la consulta.
- Organiza el workspace dental y la persistencia de la información odontogramática.
- No gestiona atención médica general ni otros módulos clínicos no dentales.
- No reemplaza el registro administrativo o de facturación.

## Integraciones

- Recursos y store del odontograma.
- UI especializada para la vista dental.
- Rutas y configuración del módulo odontológico.

## Interfaz y accesibilidad

- Los controles, ayudas, estados vacíos y nombres accesibles usan los catálogos
  de interfaz `en.json` y `es.json`. Los nombres de hallazgos, subtipos y la
  documentación clínica provienen del catálogo odontológico existente en español;
  traducir la interfaz no modifica sus identificadores, colores ni datos guardados.
- El selector de diseños conserva Carbon Modal, sus botones nativos y el estado
  `aria-pressed`. Enter y Espacio activan la misma acción que el ratón. El modo de
  selección múltiple conserva el diálogo abierto.
- El diálogo usa `enableFocusWrapWithoutSentinels` de Carbon para retener el foco
  al recorrer los diseños y `launcherButtonRef` para devolverlo a la pieza al cerrar.
- Cada pieza mantiene su dibujo de 60 × 120 unidades dentro de un botón nativo
  con nombre accesible, foco visible y activación por teclado. El modo de lectura
  deshabilita estos botones; la aplicación de diseños conserva el contrato clínico.
- Limpiar un hallazgo usa un botón Carbon independiente del selector y devuelve
  el foco a este. Solo limpia la selección temporal; no elimina hallazgos guardados
  ni guarda una atención.
- Los diálogos y la búsqueda tienen etiquetas de cierre y limpieza en el idioma
  activo. Un diseño no disponible muestra un mensaje comprensible sin nombres de
  componentes internos.
- Las pruebas de componentes usan ambos catálogos con i18next y comprueban
  selección por teclado, limpieza, etiquetas y consulta de notas en modo lectura.
  El flujo completo de registro, guardado, recarga y edición histórica requiere
  aceptación coordinada en QLTY con datos sintéticos. La revisión integral del
  lienzo, denticiones y contenido clínico continúa en
  [el issue #122](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/122)
  y los issues de aceptación odontológica; estas pruebas no certifican su cierre.
