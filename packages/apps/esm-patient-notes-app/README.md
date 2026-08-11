# esm-patient-notes-app

Microfrontend de notas del paciente. Muestra las notas registradas y proporciona el workspace para guardar el resumen de una consulta activa, incluidos diagnósticos, contexto clínico y observaciones estructuradas.

## Dependencias y acceso

El manifest `src/routes.json` declara `fhir2 >= 1.2` y `webservices.rest >= 2.2.0`. El registro de una nota requiere una consulta activa y una sesión con provider.

El botón, la ventana y el workspace del resumen de consulta usan actualmente el privilegio `app:hoja.clinica.resumenConsulta`. Este guard frontend no reemplaza los privilegios del backend para leer o crear encounters, diagnósticos y observaciones.

## Código prestacional

El selector y la observación que guarda la selección cumplen funciones distintas:

| Configuración | Propósito | Valor por defecto |
| --- | --- | --- |
| `prestacionalConceptSourceName` | Nombres alternativos, separados por comas, del ConvSet que contiene el catálogo mostrado por el selector | `Codigos Prestacionales,Códigos Prestacionales` |
| `visitNoteConfig.codigoPrestacionalConceptUuid` | Concepto pregunta de datatype `Coded` que recibe la selección | `34630b86-5106-4aea-8382-f55c02e4ba2c` |

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
