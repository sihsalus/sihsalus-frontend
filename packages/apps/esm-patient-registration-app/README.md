# esm-patient-registration-app

App para crear y editar datos de filiación, identificadores y atributos administrativos del paciente.

## Financiador y acreditación

El registro usa el catálogo canónico `Tipo de seguro` de `sihsalus-content#163`. El concepto
`Particular / Sin seguro`, presentado como `Autofinanciamiento`, es
`cc72568e-d0d9-46a8-a618-91f0d679f518`; no debe sustituirse por conceptos `Particular` de formularios
clínicos legacy.

Contrato de datos de la persona:

| Financiador        | Datos que se conservan                                                   |
| ------------------ | ------------------------------------------------------------------------ |
| SIS                | financiador, código, estado/fecha/método de acreditación y datos SETISIS |
| Otra IAFAS         | financiador y póliza; puede conservar acreditación genérica SITEDS       |
| Autofinanciamiento | solo financiador                                                         |
| Sin financiador    | ningún dato dependiente de cobertura                                     |

Al cambiar realmente de financiador se reemplaza la cobertura de forma atómica: primero se limpian el
código, la acreditación y los datos específicos del anterior y después se escribe la nueva selección o
el resultado compuesto de SETISIS/SITEDS. Así no se reinterpreta, por ejemplo, un código SIS como póliza
EsSalud, y una verificación recién aplicada se conserva aunque alguno de sus valores coincida con el
anterior. Volver a SIS comienza explícitamente en `No consultada` hasta aplicar una verificación. Abrir y
guardar un paciente EsSalud/EPS sin cambiar su financiador conserva los atributos genéricos provenientes
de SITEDS. La UI oculta los controles incompatibles y el armado del payload aplica el mismo contrato como
segunda defensa; al editar un paciente autofinanciado también se eliminan los valores incompatibles que
ya estuvieran persistidos.

El financiador continúa siendo opcional mientras Producto no apruebe la obligatoriedad y el tratamiento
de los casos sin cobertura. La consulta real a SETISIS/IAFAS y la derivación a Caja tampoco forman parte
de este contrato frontend.

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
- Para evitar personas huérfanas, el frontend exige seleccionar el tipo de relación y crea la `Person` del responsable recién al enviar el registro, junto con su `Relationship`.

Identidad documental y promoción (implementado):

- `sihsalus-content` ya define los `PersonAttributeType` de documento civil (tipo, número, estado/fuente/fecha de verificación); los UUIDs viven en `src/patient-registration/identity/identity-documents.ts`.
- La sección 0 (`Buscar/validar identidad`) busca primero en base local: paciente por `PatientIdentifier` y persona por atributo documental; RENIEC (mock hasta que se despliegue el OMOD identitylookup) solo aplica a DNI y solo si no hay coincidencias locales.
- Si el documento pertenece a una `Person` no paciente, el formulario ofrece `Registrar como paciente`: la promoción reutiliza el mismo UUID (`POST /patient` con `person: "<uuid>"`), crea la HC autogenerada y convierte el documento primario en `PatientIdentifier`. También se puede entrar con `patient-registration?promotePerson=<uuid>`.
- El frontend verifica antes de promover que la persona no sea ya paciente: el backend acepta promociones repetidas y duplica identificadores en silencio.
- La promoción está bloqueada offline.
- Al validar por RENIEC, bloquear edición en UI de documento y datos demográficos salvo corrección autorizada (pendiente del OMOD).
- No guardar documentos de responsables como `PatientIdentifier` hasta que sean pacientes.

Para el análisis completo de identidad documental, RENIEC/SIS, promoción de `Person` a `Patient`, búsqueda de responsables y casos de proveedores/doctores como `Person`, ver [responsible-person-identity-and-promotion.md](./docs/responsible-person-identity-and-promotion.md).

## Identificadores temporales

El identificador temporal debe generarse con el tipo/fuente configurada de OpenMRS/IdGen. No debe construirse en frontend con lógica ad hoc. Cuando luego aparece DNI u otro documento civil, se agrega como identificador adicional y se actualiza el estado de identificación; no se elimina automáticamente el código temporal porque sirve para reconciliación y auditoría.

## Residencia, nacimiento y contacto

El registro Perú muestra residencia, lugar de nacimiento y teléfono en una sola sección visual: `Residencia, nacimiento y contacto`.

Contrato canónico de campos territoriales:

| Campo OpenMRS    | Significado en SIH Salus                 |
| ---------------- | ---------------------------------------- |
| `country`        | País                                     |
| `address1`       | Departamento                             |
| `stateProvince`  | Provincia                                |
| `countyDistrict` | Distrito                                 |
| `cityVillage`    | Centro poblado                           |
| `address4`       | Dirección                                |
| `address13`      | Path jerárquico interno                  |
| `address14`      | Código UBIGEO interno                    |
| `address15`      | Marca interna de dirección de nacimiento |

FHIR proyecta `stateProvince` como `state`, `countyDistrict` como `district` y `cityVillage` como `city`; los campos `address*` se reciben como extensiones. Las vistas deben traducir esos alias sin reinterpretar ni mover sus valores.

La terminología sigue la [consulta oficial de centros poblados del INEI](https://www.gob.pe/24116-consultar-informacion-sobre-centros-poblados): departamento, provincia, distrito y centro poblado. Para Santa Clotilde, la referencia territorial es Loreto / Maynas / Napo / Santa Clotilde, según la [ficha distrital de Napo de SINIA/MINAM](https://sinia.minam.gob.pe/mapas/mapa-distrito-napo-2023).

La persistencia sigue separada:

- La residencia se guarda en `person.addresses` como dirección preferida (`preferred: true`) usando la plantilla de dirección activa del backend.
- El barrio se guarda como atributo de persona codificado `4a182c6e-9a19-4db8-8042-4bbf3b4308c2`, con respuestas del set `0fd3e744-6d2c-4cb3-9b7e-1f88899635d9`; no se duplica en `address3`.
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

## Carga masiva única de pacientes

La ruta administrativa `patient-import` no es un flujo ordinario de admisión. Permanece desactivada por defecto y
solo puede habilitarse para una ventana aprobada con el SHA-256 exacto del Excel, SHA completo del frontend, origen,
UUID del operador, UUID de la ubicación de sesión, vencimiento UTC y el significado explícito de `DOMICILIO`
(`address4` para dirección o `cityVillage` para centro poblado). La tarjeta se oculta fuera de ese contexto o después
del vencimiento, y la ruta directa falla cerrada.

El alcance clínico es exclusivamente pacientes adultos con DNI de ocho dígitos. Menores, personas ya existentes por
DNI, duplicados de DNI o de nombre/fecha/sexo dentro del Excel, metadata de identificadores incompleta y cualquier
resultado ambiguo se bloquean para registro o reconciliación manual. El tipo DNI debe ser `UNIQUE`; todos los identificadores
obligatorios/primarios deben tener una fuente automática válida, y todas las políticas de ubicación se validan antes
de consumir un valor IdGen.

El importador calcula el hash de los bytes exactos y deriva un UUID v5 estable por hash/fila/DNI. Antes de cualquier
escritura ejecuta un preflight completo con lecturas frescas, y lo repite dentro de un Web Lock exclusivo. Usuario,
ubicación, build y archivo se vuelven a comprobar antes de cada paciente. Cada alta se reconcilia con una lectura
fresca antes de avanzar; el primer fallo o resultado incierto detiene el lote y marca las filas restantes como no
intentadas. No existe rollback automático del lote ni una degradación sin Web Locks.

El reporte omite nombres, DNI, fecha de nacimiento y domicilio del Excel; conserva fila, estado y UUID para
reconciliación. Aun así contiene identificadores clínicos y debe mantenerse en el almacenamiento cifrado aprobado,
nunca en tickets/PR públicos. La plantilla usa solo un ejemplo inequívocamente sintético y su DNI reservado no es
importable.

La preparación, ejecución sintética, reconciliación, cierre y desactivación se describen en
[el runbook de carga masiva](../../../docs/runbooks/bulk-patient-import.md). Ninguna validación local sustituye el smoke
coordinado en DEV/QLTY; nunca ejecutar este flujo contra PROD ni con datos reales durante pruebas.

## Configuring the Registration App to collect custom observations

[PR-221](https://github.com/openmrs/openmrs-esm-patient-management/pull/221) made it possible to configure the registration app to include obs, as demoed in the gif video below, using fieldDefinitions:

![Peek 2022-07-13 15-14](https://user-images.githubusercontent.com/1031876/178846444-ac4da88a-073f-4ed2-bf00-a07cf3ab6d2f.gif)

## Resource loading behavior

Patient registration depends on metadata loaded at runtime: address template, relationship types, and patient identifier types.

Queued registration writes share the queue synchronization abort signal, including the patient-photo attachment fallback.
An interrupted upload must remain associated with the original queue owner and must not start under a later session.
Existing-patient offline refreshes require confirmed fresh network responses. A stale cached success cannot complete the
refresh, and each stable cache entry is replaced only after its corresponding network response succeeds.

- New registrations must wait for patient identifier types before submission, because the form cannot safely create the required identifiers without that metadata.
- Editing an existing patient may continue when identifier types are temporarily unavailable, as long as the form already has existing identifiers. The existing identifiers remain visible, but adding or changing identifier types is disabled until the metadata loads.
- Relationship controls are shown only after relationship types are available. If they cannot be loaded, the section shows an error state instead of an endless skeleton so the rest of the edit flow can still be used.
- Address quick search is rendered only after the address template is available. This prevents a search-only address section where the user can find an address but cannot see or edit the address fields.
