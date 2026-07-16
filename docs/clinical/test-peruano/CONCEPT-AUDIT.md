# Auditoria de conceptos TPED

Fecha de revision: **2026-07-09**.

## Resultado

La definicion normativa contiene **12 lineas y 88 hitos**. Ninguno tiene todavia un
concepto OpenMRS enlazado de forma verificable.

El prototipo retirado durante esta revision no modelaba hitos. Solo guardaba edad,
instrumento, clasificacion, porcentaje inventado, snapshot JSON, referencia, plan y notas.
Por tanto, que esos UUID existan no demuestra que los conceptos clinicos A1-L30 esten
registrados.

La definicion versionada mantiene `conceptUuid: null` en los 88 hitos hasta completar una
auditoria concepto por concepto:

- Codigo: `TPED-NTS087-2010`.
- Estado: `legacy`.
- Fuente: Anexo 9, paginas PDF 93-102 para la exploracion de hitos.
- Implementacion:
  [`tped-nts087.definition.ts`](../../../packages/apps/esm-crecimiento-desarrollo-app/src/well-child-care/test-peruano/tped-nts087.definition.ts).

## UUID que usaba el prototipo

| Uso declarado en frontend | UUID | Evaluacion |
| --- | --- | --- |
| Edad en meses | `1410AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` | Agregado; no representa un hito |
| Instrumento aplicado | `c4010001-0000-4000-8000-000000000001` | Agregado; pendiente verificar semantica real |
| Respuesta Test Peruano | `c4010013-0000-4000-8000-000000000013` | Respuesta agregada; no representa hitos |
| Clasificacion | `c4010002-0000-4000-8000-000000000002` | Conflicto: tambien se configura como falta de estimulacion |
| Desarrollo normal | `118fe066-b4a0-4978-b5b0-bb4ed7f4b80a` | Respuesta agregada; pendiente verificar |
| Riesgo | `c4010021-0000-4000-8000-000000000021` | Respuesta agregada; pendiente verificar |
| Retraso | `c4010022-0000-4000-8000-000000000022` | Respuesta agregada; pendiente verificar |
| Puntaje total | `c4010003-0000-4000-8000-000000000003` | No usar: la NTS 087 no define este porcentaje |
| Snapshot JSON | `c4010004-0000-4000-8000-000000000004` | No reemplaza observaciones clinicas estructuradas |
| Requiere referencia | `c4010005-0000-4000-8000-000000000005` | Agregado; pendiente verificar |
| Si | `cf82933b-3f3f-45e7-a5ab-5d31aaee3da3` | Respuesta generica |
| No | `488b58ff-64f5-4f8a-8979-fa79940b1594` | Respuesta generica |
| Plan | `c4010006-0000-4000-8000-000000000006` | Agregado; tambien aparece en otros modulos |
| Observaciones | `643c7023-c2f4-4796-9920-a2ed0f79ba35` | Texto generico |

El prototipo tambien reutilizaba el formulario CRED-004 y el encounter type de Control de
Nino Sano. No habia un contrato dedicado ni versionado para TPED.

## Verificacion DEV

Se intento consultar por REST los UUID anteriores usando las credenciales configuradas en
el entorno y la credencial facilitada para la revision. DEV respondio HTTP 401 en ambos
casos. No se realizo ninguna solicitud de escritura ni se modificaron usuarios,
contrasenas, conceptos, formularios o encuentros.

Hasta recuperar acceso valido, los nombres, datatypes, clases, respuestas y estado
`retired` de esos UUID se consideran **no verificados**. La afirmacion anterior del README
del modulo de que los conceptos del Test Peruano estaban validados no alcanza el nivel de
detalle necesario para este widget.

## Criterio para considerar un hito mapeado

Cada hito A1-L30 debe tener una fila de auditoria con:

- UUID OpenMRS u `external_id` OCL.
- Nombre preferido y sinonimos.
- Codigo TPED y edad exactos.
- Datatype y clase.
- Estado publicado/no retirado.
- Modalidad observada, referida o ambas.
- Fuente normativa y pagina.
- Evidencia de consulta REST en el entorno objetivo.

Una coincidencia aproximada de texto no es suficiente. Tampoco se debe mapear una linea
completa, por ejemplo "Lenguaje comprensivo", como sustituto de sus hitos individuales.

## Siguiente paso de backend

1. Restablecer un acceso GET valido a DEV.
2. Buscar por codigo y por texto los 88 hitos.
3. Verificar manualmente coincidencias de edad y significado.
4. Crear o publicar conceptos faltantes en content/OCL, con identificadores estables.
5. Agregar los UUID confirmados a la definicion y pruebas de unicidad.
6. Solo despues disenar el payload de persistencia y su auditoria clinica.
