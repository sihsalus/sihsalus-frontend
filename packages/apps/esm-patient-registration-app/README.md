# esm-patient-registration-app

App para crear y editar datos de filiación, identificadores y atributos administrativos del paciente.

## Pacientes no identificados o incapaces de comunicarse

El registro debe permitir crear un paciente aunque no exista DNI, nombre legal confirmado, teléfono, dirección o fecha exacta de nacimiento. Ese caso se marca con el atributo `Paciente No Identificado` configurado en `fieldConfigurations.name.unidentifiedPatientAttributeTypeUuid`.

Cuando el paciente está no identificado o no puede comunicar datos/consentimiento, el formulario debe exigir un responsable, acompañante, institución o autoridad. Los datos mínimos esperados son:

- una persona responsable seleccionada o registrada,
- tipo de relación con el paciente,
- sexo administrativo de la persona responsable,
- edad aproximada si el flujo local la conoce.

El DNI y el teléfono no son obligatorios en este modo. Deben quedar como desconocidos, no disponibles o pendientes de confirmar hasta que el paciente o responsable pueda aportar información confiable.

Modelo de persistencia:

- El responsable se registra como `Person` de OpenMRS y se vincula al paciente con `Relationship`.
- No se crea `Patient`, identificador ni historia clínica para el responsable solo por acompañar o representar al paciente.
- La sección Perú `Acompañante o responsable` no muestra ni valida los atributos textuales históricos `Nombre/Edad/Parentesco del acompañante`; el flujo operativo usa solo la relación estructurada.
- Para evitar personas huérfanas, el frontend exige seleccionar el tipo de relación antes de crear una nueva persona responsable.

## Identificadores temporales

El identificador temporal debe generarse con el tipo/fuente configurada de OpenMRS/IdGen. No debe construirse en frontend con lógica ad hoc. Cuando luego aparece DNI u otro documento civil, se agrega como identificador adicional y se actualiza el estado de identificación; no se elimina automáticamente el código temporal porque sirve para reconciliación y auditoría.

## Residencia, nacimiento y contacto

El registro Perú muestra residencia, lugar de nacimiento y teléfono en una sola sección visual: `Residencia, nacimiento y contacto`.

La persistencia sigue separada:

- La residencia se guarda en `person.addresses` como dirección preferida (`preferred: true`) usando la plantilla de dirección activa del backend.
- El lugar de nacimiento se guarda como una segunda dirección no preferida (`preferred: false`) dentro de `person.addresses`.
- Cuando el usuario selecciona una entrada del Address Hierarchy, el `userGeneratedId` del último nivel seleccionado se guarda por detrás como UBIGEO en `address14`. El path validado seleccionado se guarda en `address13` con separador técnico `|` (`PERU|UCAYALI|ATALAYA|RAYMONDI|AGUAJAL`) para detectar cambios manuales sin depender del texto visible. Estos campos no deben agregarse al template visible de dirección en `sihsalus-content`.
- La dirección de nacimiento se identifica con la marca interna `address15 = SIHSALUS_BIRTH_ADDRESS`. `address15` no debe agregarse al template visible de dirección en `sihsalus-content`; se usa solo para distinguir el tipo de dirección al hidratar edición/FHIR.
- No hay fallback textual de `Lugar de Nacimiento`. Ese `PersonAttributeType` debe estar retirado en `sihsalus-content`.
- El teléfono/celular se guarda como atributo de persona `14d4f066-15f5-102d-96e4-000c29c2a5d7` y también se mapea a `telecom` en el modelo FHIR/offline.

Validaciones locales:

- El teléfono es opcional, pero si se ingresa debe tener formato telefónico. Se bloquean letras y notación científica como `e100`.
- El lugar de nacimiento estructurado es opcional y reutiliza la jerarquía de direcciones del backend. No aplica defaults automáticos de residencia para evitar guardar un nacimiento falso cuando el usuario no completa la subsección.
- La búsqueda rápida de dirección permite buscar por texto y por UBIGEO. Para códigos UBIGEO usa `userGeneratedIdForParent` del módulo Address Hierarchy y soporta códigos puros (`2502010191`) o tokens de importación (`AGUAJAL%2502010191`).
- Las validaciones se aplican en el input y en el schema global de submit para cubrir flujo online, offline y tests.

Validación contra backend:

```bash
source .env
curl -fsS -u "$E2E_USER_ADMIN_USERNAME:$E2E_USER_ADMIN_PASSWORD" \
  "$E2E_API_BASE_URL/ws/rest/v1/personattributetype/14d4f066-15f5-102d-96e4-000c29c2a5d7?v=full"

curl -fsS -u "$E2E_USER_ADMIN_USERNAME:$E2E_USER_ADMIN_PASSWORD" \
  "$E2E_API_BASE_URL/ws/rest/v1/systemsetting?q=layout.address.format&v=full"
```

## Configuring the Registration App to collect custom observations

[PR-221](https://github.com/openmrs/openmrs-esm-patient-management/pull/221) made it possible to configure the registration app to include obs, as demoed in the gif video below, using fieldDefinitions:

![Peek 2022-07-13 15-14](https://user-images.githubusercontent.com/1031876/178846444-ac4da88a-073f-4ed2-bf00-a07cf3ab6d2f.gif)

## Resource loading behavior

Patient registration depends on metadata loaded at runtime: address template, relationship types, and patient identifier types.

- New registrations must wait for patient identifier types before submission, because the form cannot safely create the required identifiers without that metadata.
- Editing an existing patient may continue when identifier types are temporarily unavailable, as long as the form already has existing identifiers. The existing identifiers remain visible, but adding or changing identifier types is disabled until the metadata loads.
- Relationship controls are shown only after relationship types are available. If they cannot be loaded, the section shows an error state instead of an endless skeleton so the rest of the edit flow can still be used.
- Address quick search is rendered only after the address template is available. This prevents a search-only address section where the user can find an address but cannot see or edit the address fields.
