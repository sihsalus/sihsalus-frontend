# Límites de texto y mensajes de guardado

[Contratos clínicos](README.md) · [Contribución](../../CONTRIBUTING.md)

Este contrato aplica a los campos de texto clínicos y administrativos, incluidos
formularios de content, componentes compartidos y aplicaciones. Define criterios
para cambios nuevos y correcciones; documentarlo no modifica los formularios ya
desplegados ni acredita que todos los módulos lo cumplan.

## Elegir y mantener un límite

No existe un máximo universal aprobado por este contrato. Los números 500, 1024,
1025 y 4000 no son intercambiables ni se convierten en estándares por aparecer en
un componente. Un comentario de una orden y una narrativa guardada como
observación pueden tener contratos de persistencia diferentes.

Antes de añadir o cambiar un límite:

1. Identificar el dato, el endpoint y la propiedad de destino, incluidos los
   campos derivados o concatenados que también se envían.
2. Verificar la capacidad y validación del backend de la versión soportada con
   una referencia al esquema, código o contrato versionado. Un `maxLength` del
   frontend, el tamaño visual del control o una cifra mencionada informalmente
   no prueban ese contrato.
3. Documentar la necesidad funcional. Si se elige un máximo menor al admitido
   por persistencia, justificarlo y registrar la revisión del responsable del
   dominio; para narrativas clínicas, incluir la revisión clínica aplicable.
4. Registrar cómo se cuenta: bytes, unidades UTF-16, puntos de código u otra
   regla verificada, incluido el tratamiento de saltos de línea y espacios.
   `String.length` no equivale siempre a caracteres visibles. El contador,
   validador y payload deben ser compatibles con la regla de persistencia.
5. Reutilizar la definición canónica del mismo dato en todos sus consumidores.
   Los formularios declarativos toman el límite de su esquema versionado; los
   componentes propios usan la configuración o constante compartida apropiada.
   No mantener otro número independiente en el contador, validador o servicio.

Si el requisito o la capacidad no están verificados, registrar el pendiente y
resolver esa decisión antes de introducir un límite nuevo o cambiar el actual.
No ampliar ni reducir un máximo para hacer pasar una prueba o evitar un error
sin comprobar el contrato. Esta regla no obliga a igualar campos distintos.

El README o contrato del dominio debe conservar un registro con estos datos:

| Dato requerido       | Contenido                                                                     |
| -------------------- | ----------------------------------------------------------------------------- |
| Campo y consumidores | Nombre funcional, destino de persistencia y pantallas que lo editan           |
| Capacidad técnica    | Máximo admitido, unidad de conteo y referencia versionada que lo demuestra    |
| Decisión funcional   | Máximo elegido, justificación y revisión de dominio aplicable                 |
| Definición canónica  | Ruta del esquema, configuración o constante y dependencias de content/backend |
| Compatibilidad       | Tratamiento de valores históricos y campos derivados                          |
| Evidencia            | Casos de frontera, resultado y SHA/ambiente de la validación                  |

## Entrada, errores y valores existentes

- Mostrar el máximo y un contador accesible en los campos de texto libre que
  tengan límite. Explicar el exceso junto al campo: «Motivo del rechazo supera
  el máximo de {{max}} caracteres». No depender solo del color o de un toast.
- Validar también al enviar, incluidos pegado, valores precargados, edición y
  reintentos offline. Un atributo HTML o contador no sustituye esa validación
  ni la del servidor.
- No aplicar `slice`, `substring` ni otro recorte silencioso al dato para que el
  backend lo acepte. Mantener el texto introducido y permitir que el usuario lo
  corrija; el payload no debe contener una versión abreviada no consentida.
- Si hay un resumen derivado, distinguirlo del texto íntegro, documentar dónde
  se conserva este y comprobar su lectura completa. Un resumen no sustituye el
  contenido clínico original.
- No recortar valores históricos al abrir, visualizar o editar. Si un valor
  existente supera un límite nuevo, conservarlo y explicar la incompatibilidad;
  definir una estrategia de edición o migración antes de imponer el cambio.
- Una validación fallida o una respuesta de error debe conservar el trabajo
  introducido conforme al mecanismo de borradores autorizado del módulo, sin
  añadir almacenamiento local de datos clínicos por iniciativa propia.

## Mensajes de guardado

Usar el nombre funcional del elemento y la acción realizada. Evitar mensajes
genéricos como «El formulario se guardó» cuando se conoce el formulario. Crear y
editar deben distinguirse; las traducciones viven en `en.json` y `es.json`.
Reutilizar el nombre traducido, sin mostrar códigos técnicos de formularios ni
incluir nombres de pacientes, documentos o contenido clínico en los avisos.

| Estado comprobado                                                    | Ejemplo de mensaje                                                           |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Anamnesis nueva confirmada por el servidor                           | «Anamnesis guardada»                                                         |
| Examen físico editado y confirmado                                   | «Examen físico actualizado»                                                  |
| Solicitud de interconsulta confirmada                                | «Interconsulta solicitada»                                                   |
| Borrador persistido localmente por el mecanismo autorizado           | «Borrador de anamnesis guardado en este dispositivo»                         |
| Operación guardada en la cola offline                                | «Anamnesis pendiente de sincronización»                                      |
| Guardado rechazado por longitud                                      | «No se guardó la anamnesis. Revise los campos que superan el límite»         |
| Fallo parcial: respuesta guardada, estado de la orden sin actualizar | «La respuesta se guardó, pero la interconsulta sigue pendiente de completar» |
| Resultado no confirmado tras un fallo de conexión                    | «No se pudo confirmar el guardado de la anamnesis»                           |

Mostrar éxito solo cuando se confirme la operación que describe el mensaje.
En un flujo de varios pasos, no anunciar éxito completo antes de terminar los
pasos requeridos. Un timeout no demuestra que el servidor descartó la escritura:
comprobar el resultado antes de ofrecer un reintento que pueda duplicarla.
En los errores, indicar una acción útil según el estado real, conservar la
entrada y usar el manejo seguro de errores existente, sin exponer trazas,
endpoints, identificadores internos ni respuestas crudas del backend.

## Validación de una implementación

Usar datos sintéticos y cubrir, según el cambio:

- Longitudes `N-1`, `N` y `N+1`, pegado de texto, tildes, caracteres combinados,
  emoji, saltos de línea y valores históricos mayores que `N`.
- Coincidencia entre contador, validación y payload, incluidos prefijos y
  concatenaciones; rechazo del exceso sin pérdida silenciosa del texto.
- Creación, edición, error de validación, error de servidor, timeout, guardado
  parcial y offline cuando el módulo soporte esos estados.
- Lectura del valor íntegro después de guardar en DEV/QLTY y compatibilidad con
  los consumidores afectados. Nunca hacer estas pruebas con pacientes de PROD.
- Nombre funcional, traducciones, estado de persistencia y ausencia de datos
  identificables en cada mensaje de resultado.

Un PR de documentación puede validar formato, enlaces y coherencia del contrato.
Eso no sustituye las pruebas de una implementación posterior ni permite marcar
como corregidos límites, recortes o mensajes que sigan presentes en el código.
