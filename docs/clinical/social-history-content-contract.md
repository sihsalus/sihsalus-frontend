# Historia Social: contrato de contenido pendiente

Revisión: 21/09/2026. Esta auditoría del código y del paquete de contenido no
acredita las versiones instaladas ni el funcionamiento clínico en DEV/QLTY.

## Componentes reutilizados

Consulta Externa y Antecedentes y problemas ya comparten
`conditions-details-widget`, sus formularios y el lector REST Condition.
Los antecedentes longitudinales conservan el
[contrato de antecedentes](antecedents-data-contract.md).

Historia Social conserva `OutPatientSocialHistory`, sus seis columnas y
`patient-form-entry-workspace`. La tabla y la derivación social del formulario
histórico de antecedentes comparten `useSocialHistoryFormLauncher`. Este verifica
que el formulario configurado exista, esté publicado, no esté retirado y corresponda
al tipo de encuentro configurado antes de abrirlo. Reutiliza el mismo resolvedor
de formularios de Consulta Externa; no escribe metadata ni registros clínicos.
Un fallo mantiene el workspace de origen y muestra un mensaje traducido. La
verificación de metadata no comprueba por sí sola el esquema, los conceptos ni
los permisos de escritura del backend.

## Evidencia del paquete

Referencia: [sihsalus-content 6a612197](https://github.com/sihsalus/sihsalus-content/tree/6a6121970deda5eda3a37996a259cb76fe165eaa),
versión 1.25.20. Se revisaron los JSON de `ampathforms`, `encountertypes.csv`,
los CSV locales y los exports OCL de conceptos y mappings de
`SIHSALUS/sihsalus/2026-09-09-1`.

- El formulario predeterminado `e958f902-64df-4819-afd4-7fb061f59308` no está
  provisionado por este paquete y no existe un esquema de Historia Social
  equivalente en `ampathforms`.
- `clinicalEncounterUuid` usa `465a92f2-baf8-42e9-9612-53064be868e8`, cuya
  fila en el contenido se llama **Terapia física**. Su existencia no lo hace un
  tipo de encuentro de Historia Social.
- `clinicalEncounterFormUuid` también tiene consumidores de antecedentes
  médicos, resumen quirúrgico y hospitalización. Reemplazar su valor global por
  un formulario social afectaría esos consumidores.
- Initializer deriva el UUID persistido de los formularios AMPATH a partir del
  nombre y la versión. El UUID del JSON no garantiza la identidad REST.

| Clave frontend heredada   | UUID del concepto                      | Significado en el contenido                                      | Datatype |
| ------------------------- | -------------------------------------- | ---------------------------------------------------------------- | -------- |
| `alcoholUseUuid`          | `159449AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` | Estado de consumo de alcohol                                     | Coded    |
| `alcoholUseDurationUuid`  | `1546AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` | Consumo diario de cigarrillos                                    | Numeric  |
| `smokingUuid`             | `163201AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` | Estado de tabaquismo                                             | Coded    |
| `smokingDurationUuid`     | `159931AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` | Duración del tabaquismo, en años según su nombre completo inglés | Numeric  |
| `otherSubstanceAbuseUuid` | `163731AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` | Estado de consumo de tabaco                                      | Coded    |

La tabla utiliza **Cigarrillos por día**, **Duración del tabaquismo (años)** y
**Estado de consumo de tabaco** cuando encuentra estos UUID predeterminados.
Se conservan los nombres de configuración y los UUID para no cambiar qué
observaciones se leen. Las instalaciones que sustituyen esos conceptos conservan
sus rótulos anteriores; deben validar el significado de su configuración.
Esta corrección no reinterpreta ni migra valores históricos.

Los tres conceptos Coded de la tabla no tienen mappings `Q-AND-A` activos en el
export revisado ni respuestas añadidas por los CSV locales. Un selector construido
solo con esas referencias no dispone de un catálogo de respuestas en el paquete.
Esto no demuestra qué respuestas puedan existir en un entorno modificado.

Existen alternativas con respuestas, pero no son equivalentes automáticos:

- `fcd7736e-39d4-4ecd-84e0-9129e9690809` (**Alcohol**) y
  `a79047b1-aa5c-44ab-9410-02afb350c80a` (**Tabaco**) tienen respuestas Sí/No.
  No representan por sí mismos la distinción entre uso actual, previo o nunca.
- `4eca810a-013b-4583-90ce-8bca399a8211` es **Estado de consumo de sustancias
  ilícitas**, con Nunca/En el pasado/Actual. No equivale a cualquier otra
  sustancia ni a un diagnóstico de abuso.

## Siguiente cambio de contenido

Antes de habilitar un formulario nuevo, concretar un único contrato revisable:

1. Acordar los campos sociales de esta iteración, las respuestas y sus unidades,
   reutilizando conceptos que representen exactamente esos datos.
2. Definir su tipo de encuentro y una configuración específica para Historia
   Social, con lectura histórica explícita. No reutilizar Terapia física ni
   reemplazar los formularios médicos o quirúrgicos.
3. Versionar el esquema AMPATH y las respuestas faltantes en su fuente canónica,
   comprobar la identidad REST creada por Initializer y conservar formularios y
   encuentros históricos.
4. Validar apertura, guardado, recarga y edición desde ambas entradas con un rol
   asistencial sintético; incluir acceso denegado, error de carga y valores cero.
   Registrar versiones, capturas y limpieza de fixtures en DEV/QLTY.

La definición de campos y obligatoriedad requiere revisión funcional. La
[R.M. 214-2018-MINSA](https://www.gob.pe/institucion/minsa/normas-legales/187487-214-)
y su [modificatoria R.M. 265-2018-MINSA](https://www.gob.pe/institucion/minsa/normas-legales/187373-265-2018-minsa)
son referencias de gestión de historia clínica; no justifican inventar una
equivalencia entre los conceptos anteriores. Esta iteración no modifica formularios,
terminología OCL, permisos ni configuración instalada y no completa el registro
de Historia Social.
