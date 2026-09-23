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

## Dentición y persistencia

El odontograma inicial permite elegir dentición permanente (32 piezas) o temporal
(20 piezas) antes de ingresar datos clínicos. La selección es explícita; no se
infiere de la edad. Los registros guardados y los evolutivos conservan su variante.
Un nuevo evolutivo hereda la dentición de su inicial y comienza sin hallazgos.
El selector se bloquea al ingresar hallazgos, anotaciones o texto para evitar
que un cambio descarte información. Para otro tipo de dentición se registra un
nuevo inicial; esta integración no representa dentición mixta.

`OdontogramData.dentition` (`adult` o `child`) se guarda junto con los hallazgos,
los espacios, las especificaciones y las observaciones en el mismo snapshot JSON
del contrato AMPATH existente. Los snapshots históricos sin este campo se leen
como permanentes, que era la única variante disponible en el editor integrado.
No se añade un concepto, migración, OMOD ni almacén de estado. Las actualizaciones
siguen reutilizando los UUID de observaciones existentes. La consulta histórica
en pantalla completa no modifica el borrador compartido entre editores.

Dependencias: endpoints REST de encounters/obs de OpenMRS y los formularios,
conceptos y tipos de encuentro configurados en `config-schema.ts`. Se mantienen
los controles de acceso existentes; el dashboard requiere
`app:hoja.clinica.odontologia.editar` para iniciar edición. Los errores de guardado
conservan el borrador y usan la notificación segura existente.

### Procedencia y validación pendiente

La estructura temporal procede de la
[entrega de Mauricio Arenales](https://github.com/MauArenales/react-odontogram-v2/tree/bc00f0fa6d6120fdc3d493737ff57fbd1f7dd9ab)
(`childOdontogramData.json`, rama `mauricio`). Se adapta al renderer y catálogo
compartidos; no se incorporan los stores ni los componentes infantiles duplicados.
Las siluetas de raíces temporales se contrastaron con el anexo, página 22, de la
[NTS 188-MINSA/DGIESP-2022](https://cdn.www.gob.pe/uploads/document/file/3456674/NTS%20N%C2%BA%20188-MINSA/DGIESP-2022.pdf).

**Pendiente antes de habilitar para uso clínico:** conciliar con Mauricio/Odontología
la subdivisión de coronas y sus diseños de hallazgos. La entrega recuperada usa
ocho zonas para todos los molares temporales; el gráfico del anexo distingue las
superficies de 54/64 y 85/75. Integrar el selector no certifica la conformidad de
toda la simbología. Seguimiento: [backlog #63](https://github.com/sihsalus/sihsalus-frontend.tasktree/issues/63).

QA mínimo: permanente/temporal, crear inicial, guardar/recargar/editar, evolutivo
con su inicial, consulta histórica durante un borrador, pantalla completa, bloqueo
del cambio con datos clínicos y permiso de solo lectura. Ejecutar pruebas con
cuentas y pacientes sintéticos en DEV/QLTY coordinado y obtener aceptación de
Odontología. Las pruebas locales no acreditan ese entorno ni la conformidad clínica.

Despliegue y reversión: el lector nuevo comprende snapshots adultos anteriores,
pero un frontend anterior al cambio solo dibuja piezas permanentes. Después de
crear snapshots temporales, no volver a ese lector para uso odontológico; mantener
la lectura compatible o suspender coordinadamente ese flujo mientras se corrige.
Conservar los encounters y observaciones existentes.

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
