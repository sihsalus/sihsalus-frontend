# esm-patient-notes-app

Microfrontend de notas del paciente. Muestra las notas registradas y proporciona el workspace para guardar el resumen de una consulta activa, incluidos diagnósticos, contexto clínico y observaciones estructuradas.

## Dependencias y acceso

El manifest `src/routes.json` declara `fhir2 >= 1.2` y `webservices.rest >= 2.2.0`. El registro de una nota requiere una consulta activa y una sesión con provider.

La lectura usa `app:hoja.clinica.resumenConsulta`; el botón, la ventana y el workspace que modifican el resumen requieren `app:hoja.clinica.resumenConsulta.editar`. Estos guards frontend no reemplazan los privilegios del backend para leer o crear encounters, diagnósticos y observaciones.

## Contrato de guardado del resumen

- El propio workspace resuelve el resumen canónico por paciente, visita, EncounterType y formulario: cero coincidencias crea; una edita; más de una, una respuesta incompleta o una identidad distinta bloquean la edición. Este contrato aplica a todos los botones que abren el workspace y no depende de que cada consumidor pase `formContext` correctamente.
- La creación falla de forma cerrada si no hay una visita activa o si esa visita no tiene una UPSS asistencial. El encounter nuevo se adjunta explícitamente a esa visita.
- La edición falla de forma cerrada si el encounter no tiene visita asociada o pertenece a una visita distinta de la visita activa. Conserva los `encounterProviders` originales; el provider de la sesión solo se usa al crear o cuando el encounter heredado no tiene uno válido.
- Encounter, diagnósticos CIE-10 y observaciones se envían juntos en una única operación REST de encounter. Al editar se reutilizan los UUID existentes y se envía `{ "uuid": "...", "voided": true }` para valores retirados, evitando el estado parcial que producía borrar y recrear diagnósticos con solicitudes separadas.
- El listado identifica los resúmenes por el EncounterType y formulario configurados. No depende de una observación de diagnóstico heredada, por lo que también muestra encounters que guardan únicamente `diagnoses` estructurados.
- Los consumidores pueden pasar `onAfterSave` para revalidar sus datos tras un HTTP 200/201. Ese callback es de mejor esfuerzo: una falla de caché no cambia un guardado clínico exitoso a estado de error.
- Los adjuntos siguen siendo una operación posterior e independiente del guardado del encounter. Una falla de adjunto no revierte ni repite el encounter ya aceptado por OpenMRS: el workspace se cierra informando que el resumen sí fue guardado y que hubo adjuntos pendientes.

## Código prestacional

El selector y la observación que guarda la selección cumplen funciones distintas:

| Configuración                                   | Propósito                                                                                                | Valor por defecto                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `prestacionalConceptSourceName`                 | Nombres alternativos, separados por comas, del ConvSet que contiene el catálogo mostrado por el selector | `Codigos Prestacionales,Códigos Prestacionales` |
| `visitNoteConfig.codigoPrestacionalConceptUuid` | Concepto pregunta de datatype `Coded` que recibe la selección                                            | `34630b86-5106-4aea-8382-f55c02e4ba2c`          |

Aunque conserva el nombre histórico `prestacionalConceptSourceName`, el primer parámetro no busca un Concept Source de OpenMRS. La implementación localiza por nombre/display el ConvSet configurado y filtra sus `setMembers`.

Al guardar, el UUID del miembro seleccionado se persiste como `valueCoded`:

```json
{
  "concept": { "uuid": "34630b86-5106-4aea-8382-f55c02e4ba2c" },
  "value": "<uuid-del-codigo-seleccionado>",
  "formFieldNamespace": "visit-notes",
  "formFieldPath": "codigo-prestacional"
}
```

`codigoPrestacionalConceptUuid` no debe apuntar al ConvSet `e82d45de-8696-42f8-99bc-337a750a7102` (`Codigos Prestacionales`). Ese concepto tiene datatype `N/A`: enviarle un valor hace que OpenMRS rechace el encounter completo. El ConvSet solo es la fuente de opciones; la pregunta `Coded` es el destino de la observación.

### Migración de configuración

Los despliegues que sobrescribían `visitNoteConfig.codigoPrestacionalConceptUuid` con el UUID del ConvSet deben retirar o corregir ese override. Un override externo prevalece sobre el nuevo valor por defecto y mantendría el error de persistencia.

La validación actual permite guardar sin seleccionar un código prestacional; en ese caso no se emite esta observación. La etiqueta de la interfaz todavía lo presenta como obligatorio, por lo que no se debe depender de esa indicación hasta alinear la validación y la UI.

## Configuración clínica

Los conceptos usados para motivo de consulta, anamnesis, funciones biológicas, SOAP, órdenes, procedimientos, prescripciones, referencia y próxima cita viven bajo `visitNoteConfig`. Deben resolverse contra el content package del ambiente; no se deben sustituir con UUIDs hardcodeados dentro de componentes.

`visitNoteConfig.encounterTypeUuid`, `formConceptUuid`, `clinicianEncounterRole` y `visitDiagnosesConceptUuid` también deben corresponder al modelo de encounters y diagnósticos del backend desplegado.

## Desarrollo

```bash
yarn workspace @sihsalus/esm-patient-notes-app test
yarn workspace @sihsalus/esm-patient-notes-app typescript
yarn workspace @sihsalus/esm-patient-notes-app build
```
