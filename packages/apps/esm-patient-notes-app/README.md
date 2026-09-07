# esm-patient-notes-app

Microfrontend de notas del paciente. Muestra las notas registradas y proporciona el workspace para guardar el resumen de una consulta activa, incluidos diagnósticos, contexto clínico y observaciones estructuradas.

## Dependencias y acceso

El manifest `src/routes.json` declara `fhir2 >= 1.2` y `webservices.rest >= 3.5.0`. Esta versión REST admite el UUID de cliente usado para la unicidad de creación. El registro de una nota requiere una consulta activa y una sesión con provider.

La lectura usa `app:hoja.clinica.resumenConsulta`; el botón, la ventana y el workspace de edición usan `app:hoja.clinica.resumenConsulta.editar`. El componente de lectura no ejecuta el fetch sin el primer privilegio. Estos guards frontend no reemplazan los privilegios REST del backend.

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

La validación exige seleccionar un miembro real del catálogo; el texto libre no genera un encounter.

Diagnósticos y códigos prestacionales solicitan también los `conceptMappings` de cada concepto. La interfaz presenta ambos catálogos como `<código> - <denominación>`; conserva compatibilidad con conceptos históricos que traen el código dentro de `display`, pero prefiere el mapping CIE-10 o SIS/FUA cuando está disponible. La búsqueda prestacional también admite el código guardado únicamente en el mapping.

La búsqueda de diagnósticos acepta códigos CIE-10 con o sin punto. Para una entrada como `K71.0` consulta tanto `K710`, que es el formato usado por los nombres cortos del catálogo MINSA importado, como `K71.0`, fusiona los resultados sin duplicados y prioriza la coincidencia exacta respaldada por un mapping CIE-10 o por el nombre corto del catálogo.

En una visita del tipo ambulatorio configurado, el guardado exige exactamente un diagnóstico principal y que cada diagnóstico principal o secundario seleccionado tenga un mapping estructurado con fuente CIE-10/ICD-10 y código no vacío. El texto visible o la forma aparente del código no se usan como autoridad. Los demás tipos de visita conservan su comportamiento previo.

El profesional del encounter se registra con `visitNoteConfig.clinicianEncounterRole`. La colegiatura mostrada se obtiene únicamente del Provider Attribute Type configurado en `professionalRegistrationProviderAttributeTypeUuid`; no se sustituye con el identificador del provider. Su ausencia no bloquea el guardado clínico, porque el despliegue puede completar el dato después y los documentos conservan una línea de firma, sello y colegiatura manual. Esto no constituye firma digital.

### Referencias oficiales configurables

Los botones de ayuda abren fuentes peruanas oficiales en una pestaña nueva. Las URL son configurables porque la versión normativa y el catálogo desplegado deben mantenerse coordinados:

| Configuración              | Fuente por defecto                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cie10ReferenceUrl`        | [MINSA/REUNIS: manuales y códigos CIE-10](https://www.minsa.gob.pe/reunis/index.asp?niv=1&op=3), que incluye el Excel oficial y los anexos vigentes de uso/cese                            |
| `prestacionalReferenceUrl` | [SIS: Resolución Gerencial N.° 000002-2026-SIS/GREP](https://www.gob.pe/institucion/sis/normas-legales/7772769-000002-2026-sis-grep), vigente desde el 1 de marzo de 2026 para códigos FUA |

Un despliegue que use una versión posterior debe actualizar la URL junto con el contenido importado; el enlace de ayuda no valida ni reemplaza el catálogo OpenMRS/OCL.

## Configuración clínica

Los conceptos usados para motivo de consulta, anamnesis, funciones biológicas, SOAP, órdenes, procedimientos, prescripciones, referencia/contrarreferencia y próxima cita viven bajo `visitNoteConfig`. Deben resolverse contra el content package del ambiente; no se deben sustituir con UUIDs hardcodeados dentro de componentes.

Motivo de consulta, tiempo de enfermedad, funciones biológicas, SOAP, exámenes auxiliares, procedimientos, prescripciones y referencia/contrarreferencia son una proyección de solo lectura de lo registrado por Consulta Externa durante la atención. Notas de visita no vuelve a persistir esos valores ni usa su propio encounter como fuente del resumen. Las interconsultas no forman parte del concepto de referencia: permanecen como órdenes en `esm-interconsultas-app`.

Los defaults con contrato de datatype son:

| Campo               | UUID                                   | Datatype REST         |
| ------------------- | -------------------------------------- | --------------------- |
| Exámenes auxiliares | `f0000204-0000-4000-8000-000000000204` | `Text`                |
| Prescripciones      | `f0000215-0000-4000-8000-000000000215` | `Text`                |
| Próxima cita        | `f0000004-0000-4000-8000-000000000004` | `Date` (`YYYY-MM-DD`) |

Se usa `f0000004` para próxima cita porque es la pregunta `Date` de CE-001. El UUID histórico `47ce3ee6-ee9f-4037-901b-2a6381c4b340` se lee y se limpia como alias de migración, pero no recibe observaciones nuevas. El formulario `c75f120a-04ec-11e3-8780-2b40bef9a44b` conserva su UUID y debe ser provisionado por el paquete de content coordinado.

`visitNoteConfig.encounterTypeUuid`, `formConceptUuid`, `clinicianEncounterRole` y `visitDiagnosesConceptUuid` también deben corresponder al modelo de encounters y diagnósticos del backend desplegado.

## Unicidad y guardado

La identidad canónica es paciente + atención + tipo de encounter + formulario. Las búsquedas REST solo envían filtros soportados (`patient`, `visit`, `encounterType`), recorren todas las páginas y verifican también `form` en cliente. Cero coincidencias crea, una edita y más de una falla cerrado.

La creación asigna un UUID v5 determinista a esa identidad y el submit tiene un mutex síncrono. Un timeout o conflicto se consulta por UUID; aunque coincida la identidad, la UI exige recargar porque otro dispositivo pudo haber guardado contenido clínico distinto. Diagnósticos y observaciones se reconcilian dentro del mismo payload del encounter.

Una revalidación en segundo plano mantiene el formulario montado para no perder cambios locales, pero bloquea el guardado mientras está en curso. Si la revalidación falla, muestra un aviso persistente y exige recargar antes de escribir sobre una versión que ya no pudo verificarse.

## Desarrollo

```bash
yarn workspace @sihsalus/esm-patient-notes-app test
yarn workspace @sihsalus/esm-patient-notes-app typescript
yarn workspace @sihsalus/esm-patient-notes-app build
```
