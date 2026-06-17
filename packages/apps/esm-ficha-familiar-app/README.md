# esm-ficha-familiar-app

App para la ficha familiar y el contexto relacional del hogar.

Terminología de dominio: visita = consulta, encounter = atención, appointment = cita.

## Marco normativo
- Ley N.° 29733, Ley de Protección de Datos Personales (Perú).

## Límites funcionales
- Gestiona relaciones familiares, parentescos y listas de contactos asociados al paciente.
- Expone vistas para historia familiar y relación entre miembros del núcleo familiar.
- No administra el registro clínico general ni procesos de facturación o farmacia.
- No cubre programación de citas ni hospitalización.

## Integraciones
- APIs de relaciones, contactos y contexto familiar.
- Autocomplete y componentes de selección compartidos.
- Configuración de dashboard y rutas del módulo.

## TODO content/backend

- Validar en QLTY que todos los UUIDs de `familyRelationshipsTypeList`, `pnsRelationships` y `otherRelationships` existan como relationship types activos y no sean placeholders.
- Los person attributes de `contactPersonAttributesUuid` deben venir de `sihsalus-content` y usar conceptos OCL codificados para estado VIH basal, contacto creado desde PNS, método PNS, convivencia, resultado IPV y consentimiento Ley 29733.
- Completar `registrationObs.registrationFormUuid` cuando el flujo de creación de familiares deba asociar un formulario OpenMRS real al encounter administrativo de registro.
- Validar `defaultIDUuid` y `defaultIdentifierSourceUuid` contra IdGen/content para evitar crear familiares sin identificador válido.
- Confirmar que `formsList.htsInitialTest` exista en content/QLTY antes de habilitar chequeos PNS/VIH como flujo obligatorio; `hivProgramUuid` y `encounterTypes.hivTestingServices` ya apuntan a metadata SIH Salus.

## TODO QA/QLTY

- Probar formulario por formulario en QLTY: abrir, completar campos obligatorios, guardar, recargar, editar si aplica y confirmar que relaciones/contactos leen los datos persistidos.
- Probar en QLTY el flujo end-to-end de relaciones familiares: buscar familiar existente, crear relación, recargar y confirmar persistencia.
- Probar creación de familiar nuevo desde el workspace, incluyendo identificador, parentesco, fecha de nacimiento y datos mínimos de persona.
- Probar edición y eliminación de relaciones, incluyendo confirmación visual y recarga de dashboard.
- Probar lista de contactos PNS/VIH: agregar contacto, editar atributos sensibles, validar consentimiento y confirmar lectura posterior.
- Validar permisos de usuario para crear/editar relaciones, person attributes y pacientes relacionados en QLTY.
- Mantener pacientes de prueba para hogar sin relaciones, hogar con familia nuclear, hogar extendido y contacto PNS sensible.

## TODO i18n/UI

- Traducir títulos de workspaces que siguen en inglés en `routes.json`: `Family Relationship Form`, `Other Relationships Form`, `Relationship Update Form` y `Contact List Form`.
- Agregar smoke tests que detecten claves crudas o textos técnicos visibles en relaciones, contactos y estados vacíos.
- Revisar componentes que usan `useTranslation()` sin namespace explícito cuando se renderizan desde slots del patient chart.
- Validar que datos sensibles de PNS/VIH no se muestren por defecto y que el componente de revelado sea claro en desktop/tablet.
- Revisar textos de parentesco para evitar mezclar labels configurados en content con strings hardcodeados.
