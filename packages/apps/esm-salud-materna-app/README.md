![Node.js CI](https://github.com/sihsalus/openmrs-esm-sihsalus-modules/workflows/Node.js%20CI/badge.svg)

El formulario de antecedentes por catálogo es `ConditionConceptSetForm` de `esm-patient-common-lib`. Este módulo conserva únicamente el adaptador de permiso, traducción y conjunto de conceptos; no mantiene copias del formulario, sus campos o estilos. Los campos tienen desplazamiento propio y las acciones permanecen visibles. Se conservan los filtros clínicos, permisos y contratos de guardado de cada módulo. Validar panel estrecho y tablet, creación/edición y cambio de paciente con datos sintéticos en QLTY.

# SIH SALUS ESM Modules

Colección de módulos microfrontend para SIH SALUS, una distribución especializada de OpenMRS 3.x adaptada al ecosistema de salud peruano y las directrices del MINSA.

## Cobertura normativa de madre gestante

Base normativa revisada:

- NTS N° 105-MINSA/DGSP.V.01, Norma Técnica de Salud para la Atención Integral de Salud Materna, aprobada por RM N° 827-2013/MINSA y precisada por RM N° 159-2014/MINSA.
- NTS N° 130-MINSA/2017/DGIESP, Norma Técnica de Salud para la Atención Integral y Diferenciada de la Gestante Adolescente durante el Embarazo, Parto y Puerperio.
- Normativa materno-neonatal complementaria publicada en gob.pe, incluyendo parto vertical, pertinencia cultural y guías de emergencias obstétricas según capacidad resolutiva.

Cobertura frontend actual:

- Atención prenatal reenfocada: antecedentes obstétricos, embarazo actual, atención prenatal, tamizaje prenatal, suplementación gestante, plan de parto, psicoprofilaxis y clasificación de riesgo obstétrico mediante conceptos configurables.
- Parto institucional y calificado: parto/aborto, partograma y resumen de parto-postparto.
- Puerperio: puerperio inmediato, control de puerperio, egreso materno y reingreso materno cuando el content package provee esos formularios.
- Atención integral diferenciada: salud mental perinatal, tamizaje de violencia en gestante, planificación familiar post evento obstétrico y prevención de cáncer cervical/mama.
- Gestante adolescente: el módulo deja el punto de extensión `formsList.adolescentPregnancyCareForm`; permanece vacío por defecto porque el content package aún no contiene un formulario específico NTS 130.

El historial de condiciones comparte lectura, creación, corrección y anulación REST, con paginación completa y estados clínicos precisos. Crear o editar una condición exige un proveedor clínico asociado a la sesión. La creación deriva el registrador de la sesión autenticada; la corrección parcial usa REST y conserva la versión original mediante el versionado de core. Cada versión tiene su autor y fecha de registro; la fecha clínica no cambia si no se edita. El UUID del proveedor no identifica al usuario registrador. Este contrato se ha revisado contra core 2.8.9 y REST 3.5.0; la validación con el backend instalado sigue pendiente. Los límites de persistencia, contenido y auditoría se documentan en el [contrato de antecedentes](../../../docs/clinical/antecedents-data-contract.md).

El grupo Madre Gestante requiere sesión autenticada, acceso a la historia y permiso de lectura de al menos uno de
sus paneles. Un rol de parto o puerperio no necesita permiso prenatal para ver el grupo; la condición existente de
sexo e inscripción al programa sigue vigente. Cada panel conserva su privilegio propio.
Los registros compartidos del grupo y selector exigen `app:hoja.clinica`; el componente aplica la alternativa de
permisos, porque un arreglo en `routes.json` exigiría todos a la vez. El selector solo monta lectores y muestra
formularios cuando el usuario tiene lectura y edición de la misma familia, además del acceso a la historia.
Antes de abrir un formulario vuelve a comprobar la cuenta y sus permisos; no concede edición por tener acceso
a otro panel. Las pruebas de regresión cubren roles prenatal, parto y puerperio, denegación y revocación.
El selector resuelve el nombre exacto o UUID configurado con el mismo resolutor de los botones maternos antes
de abrir el formulario. Solo abre una coincidencia publicada y no retirada; conserva el encuentro seleccionado
y la actualización posterior al guardado. Los errores muestran un mensaje genérico y permiten reintentar;
las aperturas pendientes se descartan al cerrar el selector o perder el acceso, y se evitan clics duplicados.

Vacíos conocidos:

- Falta convertir el placeholder de gestante adolescente en formulario real cuando content incorpore la ficha diferenciada.
- Falta checklist operativo para referencia/contrarreferencia y pertinencia cultural; hoy dependen de workflows generales del HIS.
- Falta auditoría de cumplimiento normativo por control prenatal; los datos existen como formularios/obs, pero no hay panel de brechas por estándar.

## TODO content/backend

- Validar los UUIDs de controles CRED copiados en `config-schema.ts`; `consultationTime` y `controlNumber` no deben compartir el mismo concepto.
- Completar `CRED.perinatalConceptSetUuid` con el concept set real del content package o desactivar las vistas que dependen de ese set.
- Completar `legendConceptSetUuid` cuando exista el set real en OCL/content.
- Conectar los componentes placeholder de prevención de cáncer y planificación familiar a hooks SWR reales cuando estén definidos los conceptos clínicos.
- Probar formularios de salud materna contra backend actualizado: prenatal, postnatal, partograma, planificación familiar y prevención de cáncer.

## Validación local

`yarn workspace @sihsalus/esm-salud-materna-app typescript` comprueba tanto el
código del módulo como sus tests `.test.ts` y `.test.tsx`. Los mocks deben respetar
los contratos de los hooks y componentes; no se excluyen del compilador.
Ejecutar también `yarn workspace @sihsalus/esm-salud-materna-app test`
para validar las aserciones de comportamiento.

## TODO QA/QLTY

- Probar formulario por formulario en QLTY: abrir, completar campos obligatorios, guardar, recargar, editar si aplica y confirmar que el widget correspondiente lee los datos persistidos.
- Probar en QLTY el flujo end-to-end de salud materna: abrir formulario, guardar, recargar la historia y confirmar que las tablas/widgets leen el encounter y las obs guardadas.
- Validar prenatal: historia materna, embarazo actual, atención prenatal, suplementación, plan de parto, psicoprofilaxis y clasificación de riesgo.
- Validar parto: resumen de labor y puerperio, parto/aborto y partograma con datos sintéticos en DEV/QLTY autorizado y coordinado.
- Validar puerperio: puerperio inmediato, controles postnatales y seguimiento.
- Validar planificación familiar y prevención de cáncer cuando los conceptos clínicos y formularios reales estén completos en content.
- Confirmar permisos de usuario para crear y editar formularios de salud materna en QLTY, no solo para visualizar dashboards.

## TODO i18n/UI

- Agregar smoke tests que detecten claves crudas visibles en dashboards, por ejemplo `PrenatalCare`, `maternalHistory`, `prenatalAttention`, `familyPlanning` o `postnatalCare`.
- Agregar smoke test para textos duplicados de estados vacíos, por ejemplo `No hay no hay`.
- Revisar componentes de salud materna que usan `useTranslation()` sin namespace explícito cuando se renderizan dentro de slots compartidos.
- Revisar labels largos de tabs y tarjetas para que no se corten en 1280px ni en tablet.
- Revisar `en.json` porque aún conserva textos heredados en español y puede confundir validaciones bilingües.

## 🏥 Características Principales

- **SIH SALUS Library**: Componentes UI y servicios comunes optimizados para el flujo de trabajo peruano
