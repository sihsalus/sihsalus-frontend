# Historia Social: contrato de contenido y frontend

Revisión: 21/09/2026. Esta auditoría del código y del paquete de contenido no
acredita las versiones instaladas ni el funcionamiento clínico en DEV/QLTY.

## Componentes reutilizados

Consulta Externa y Antecedentes y problemas ya comparten
`conditions-details-widget`, sus formularios y el lector REST Condition.
Los antecedentes longitudinales conservan el
[contrato de antecedentes](antecedents-data-contract.md).

Historia Social comparte `OutPatientSocialHistory`, `ClinicalHistoryCard` y
`patient-form-entry-workspace` entre sus entradas. La tabla y la derivación social
del formulario histórico de antecedentes usan `useSocialHistoryFormLauncher`.
Este reutiliza el resolvedor de formularios de Consulta Externa y comprueba
publicación, tipo, paciente y visita antes de abrir Workspace2. Un fallo conserva
el workspace de origen y muestra un mensaje traducido. La implementación se
describe después del inventario heredado siguiente.

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

## Implementación de esta iteración

`socialHistory.formUuid` usa el Form persistido `76067e7a-48e5-3f69-92a4-70cf53e3e994`
de `CE-SOC-001-HISTORIA SOCIAL` 1.0.0, incorporado en content 1.25.23.
`socialHistory.encounterTypeUuid` usa `c7059f4b-385f-45e7-82ad-204e5b380196`
(Historia social). El UUID del esquema JSON es
`f18f4320-690b-4c34-9b20-89a9bf7fec71`; no se utiliza como UUID REST.

La configuración `socialHistory.concepts` contiene Alcohol y Tabaco con sus
respuestas Sí/No ya mapeadas, cigarrillos por día y duración del tabaquismo en
años. Los dos valores numéricos conservan los conceptos existentes de la tabla
anterior. Las preguntas son opcionales y no tienen valores predeterminados:
no evaluado no equivale a No o cero. Otras sustancias quedan fuera de esta
iteración. No se cambia el diccionario OCL ni se calculan diagnósticos.

Ambas entradas siguen montando `OutPatientSocialHistory`. La tarjeta nueva
reutiliza `ClinicalHistoryCard`, `CardHeader`, estados vacíos, paginación y
controles Carbon de Anamnesis y Diagnóstico; no introduce un formulario React
paralelo. El formulario usa el workspace de entrada AMPATH existente. La tabla
usa tamaño compacto en escritorio y amplio en tablet, con desplazamiento
horizontal local cuando sea necesario. Los registros anteriores se presentan
en otra tarjeta de solo lectura, conservando sus cinco campos y los rótulos
específicos de conceptos personalizados. No se migran ni se reinterpretan.

La nueva consulta valida paciente y tipo de encuentro en cada página antes de
mostrar los datos, filtra por Form en el cliente (REST no soporta ese filtro),
ordena por fecha y pagina con el lector compartido. Un fallo o truncamiento no
se muestra como ausencia de antecedentes. La lectura de registros anteriores
conserva el lector genérico existente y sus limitaciones; no añade paginación
al historial heredado en esta iteración.

Al registrar, se requiere una visita ambulatoria activa. Se verifica el Form
publicado y no retirado, se busca un encuentro de ese Form en esa visita y se
abre el existente; varios resultados bloquean la apertura por ambigüedad.
Al editar desde una fila se verifica de nuevo su paciente, Form, tipo y visita,
y se conserva la visita original, incluso si ya terminó. Se usa Workspace2
con contexto explícito y se respeta su rechazo a abrir/cambiar un formulario.
El permiso `app:hoja.clinica.historiaSocial.editar` se comprueba tanto en las
acciones visibles como en el lanzador. Un cambio de paciente, visita o permisos
invalida una apertura pendiente; una apertura fallida conserva el workspace de
origen. El cierre del formulario actualiza ambos historiales.

## Validación y puesta en servicio

Las pruebas locales cubren identidad, publicación y tipo del Form; visita activa,
edición con visita anterior, duplicados, permisos, cambio de paciente y errores
seguros; también cubren datos cero, ausentes, etiquetas históricas y tamaños de
tabla. La revisión visual local usa componentes y estilos reales con lectores
simulados y datos sintéticos: no demuestra guardado ni integración con OpenMRS.

El content debe publicarse y cargarse antes de habilitar este frontend. Preparar
los PR no publica una versión ni cambia automáticamente el pin del distro.
Se requiere todavía en DEV/QLTY coordinado: verificar la identidad REST creada
por Initializer, guardar/reabrir/editar desde ambas entradas, permisos por rol,
conservación de visita y datos previos, aceptación clínica y limpieza de fixtures.
Los PR permanecen en borrador hasta completar esa evidencia.

La [R.M. 214-2018-MINSA](https://www.gob.pe/institucion/minsa/normas-legales/187487-214-)
y su [modificatoria R.M. 265-2018-MINSA](https://www.gob.pe/institucion/minsa/normas-legales/187373-265-2018-minsa)
son referencias de gestión de historia clínica. No prescriben estas cuatro
preguntas ni sustituyen la aceptación clínica institucional.
