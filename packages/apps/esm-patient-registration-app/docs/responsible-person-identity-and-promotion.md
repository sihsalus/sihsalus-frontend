# Responsable, identidad documental y promoción a paciente

Estado: propuesta de diseño y matriz de pruebas  
Dominio: admisión, registro de pacientes, responsable/acompañante, identidad civil  
Fecha: 2026-06-30

## Resumen ejecutivo

El modelo más alineado con OpenMRS es:

1. Registrar al responsable, acompañante, familiar, representante, institución o autoridad como `Person` cuando no requiere atención clínica.
2. Relacionarlo con el paciente mediante `Relationship`, porque las relaciones en OpenMRS son entre `Person` y `Person`.
3. Si esa persona luego requiere atención, promocionar la misma `Person` a `Patient` usando `POST /ws/rest/v1/patient` con `person: <personUuid>` e identificadores.
4. No crear un `Patient` provisional para todo responsable salvo que el proyecto acepte explícitamente el costo de ensuciar la búsqueda global de pacientes, reportes y métricas.

La decisión importante no es solo técnica. Es una decisión de calidad de datos. Crear `Patient` para acompañantes hace más simple reutilizar documentos, pero convierte en pacientes a personas que quizá nunca serán atendidas. La promoción conserva mejor la semántica de OpenMRS, pero exige UX de búsqueda, confirmación y manejo de duplicados.

Recomendación: mantener el flujo principal como `Person` + promoción. Implementar una UX clara para buscar personas existentes antes de crear pacientes, y tratar documentos civiles del responsable como datos de persona hasta que se convierta en paciente.

## Fuentes verificadas

- OpenMRS core define `Patient` como una extensión de `Person`: https://github.com/openmrs/openmrs-core/blob/bac3e314d7fa3f8bc1c960467e2f966bb4c928f7/api/src/main/java/org/openmrs/Patient.java
- OpenMRS core define `Person` como entidad genérica para nombres, direcciones, atributos, sexo, nacimiento y estado vital: https://github.com/openmrs/openmrs-core/blob/bac3e314d7fa3f8bc1c960467e2f966bb4c928f7/api/src/main/java/org/openmrs/Person.java
- OpenMRS core define `Relationship` entre `Person` y `Person`: https://github.com/openmrs/openmrs-core/blob/bac3e314d7fa3f8bc1c960467e2f966bb4c928f7/api/src/main/java/org/openmrs/Relationship.java
- OpenMRS core define `PatientIdentifier` asociado a `Patient`: https://github.com/openmrs/openmrs-core/blob/bac3e314d7fa3f8bc1c960467e2f966bb4c928f7/api/src/main/java/org/openmrs/PatientIdentifier.java
- OpenMRS REST soporta crear un `Patient` desde una `Person` existente y lo llama explícitamente promoción: https://github.com/openmrs/openmrs-module-webservices.rest/blob/6f5471d1aaba5201e322adcad94788e62c5d92b1/omod/src/main/java/org/openmrs/module/webservices/rest/web/v1_0/resource/openmrs1_8/PatientResource1_8.java

## Contexto local

El app de registro ya tiene una separación relevante:

- El buscador global de pacientes usa `GET /ws/rest/v1/patient?q=...`. Por eso solo debe mostrar pacientes.
- El buscador de responsable dentro de admisión usa `GET /patient?q=...` y `GET /person?q=...`. Por eso puede encontrar pacientes, personas no pacientes, proveedores y potencialmente usuarios/staff si el backend los indexa como personas.
- El responsable nuevo se crea hoy con `POST /person`.
- La relación se guarda con `POST /relationship`.
- El paciente nuevo se crea con `POST /patient`.
- El flujo actual de paciente nuevo genera un `uuid` nuevo, por lo que todavía no soporta promocionar una `Person` existente desde la UI principal.

Este documento describe cómo cerrar esa brecha sin romper la semántica de OpenMRS.

## Glosario

- `Person`: entidad humana o stub de persona en OpenMRS. Puede ser paciente, proveedor, usuario, responsable, familiar, acompañante o una persona mínima.
- `Patient`: especialización clínica de `Person`. Aparece en búsqueda global de pacientes y puede recibir encuentros, visitas, órdenes, alergias, diagnósticos e identificadores de paciente.
- `PatientIdentifier`: identificador formal de paciente, como historia clínica, DNI como identificador de paciente, carné de extranjería como identificador de paciente o código temporal.
- `PersonAttribute`: atributo flexible de persona. Sirve para teléfono, email, ocupación, nacionalidad o datos administrativos locales. No reemplaza completamente a `PatientIdentifier`.
- `Relationship`: vínculo entre dos personas. No requiere que ambas sean pacientes.
- Promoción: convertir una `Person` existente en `Patient`, conservando el mismo UUID/persona y agregando identificadores de paciente.
- Responsable: persona, familiar, acompañante, institución o autoridad que representa o acompaña al paciente. No necesariamente es paciente.
- RENIEC: fuente externa para validar identidad civil peruana por DNI.
- SIS: fuente externa para validar seguro/acreditación. Puede depender de DNI u otros datos según integración disponible.
- CE: carné de extranjería.

## Principios de diseño

1. No crear pacientes falsos.
   Una persona no debe entrar al universo de pacientes solo por acompañar a otra persona.

2. No perder identidad humana.
   Si un responsable luego se atiende, debe reutilizarse la misma persona, no crear un duplicado.

3. No autopromover por coincidencias débiles.
   Nombre, teléfono, dirección o edad no bastan para convertir una persona en paciente sin confirmación humana.

4. Documentos civiles pueden ser múltiples.
   Una persona puede tener DNI, CE, pasaporte u otros documentos en momentos distintos o simultáneamente.

5. RENIEC verifica DNI, no identidad universal.
   RENIEC debe reforzar decisiones para DNI peruano, pero no resolver CE, pasaporte, personas sin documento o documentos vencidos.

6. El buscador debe distinguir el tipo de entidad.
   Resultado paciente, persona no paciente, proveedor/staff y posible duplicado deben verse distinto.

7. Staff y proveedores son `Person`.
   Doctores, enfermeros, usuarios y proveedores pueden aparecer en búsqueda de personas. No deben convertirse accidentalmente en pacientes.

8. Offline debe ser conservador.
   Promoción, RENIEC y deduplicación requieren información online. En offline se debe evitar crear estados difíciles de reconciliar.

## Modelo recomendado

### Responsable no atendido

Persistir como:

```json
POST /ws/rest/v1/person
{
  "names": [
    {
      "givenName": "Maria",
      "familyName": "Quispe",
      "preferred": true
    }
  ],
  "gender": "F",
  "birthdate": "1986-01-01",
  "birthdateEstimated": true,
  "addresses": [
    {
      "address1": "Jr. Principal 123",
      "preferred": true
    }
  ],
  "attributes": [
    {
      "attributeType": "<phoneAttributeTypeUuid>",
      "value": "987654321"
    }
  ]
}
```

Luego vincularlo:

```json
POST /ws/rest/v1/relationship
{
  "personA": "<responsiblePersonUuid>",
  "personB": "<patientUuid>",
  "relationshipType": "<relationshipTypeUuid>"
}
```

### Responsable que luego se atiende

Promover:

```json
POST /ws/rest/v1/patient
{
  "person": "<existingPersonUuid>",
  "identifiers": [
    {
      "identifier": "HC-000123",
      "identifierType": "<medicalRecordIdentifierTypeUuid>",
      "location": "<locationUuid>",
      "preferred": true
    }
  ]
}
```

Luego actualizar datos demográficos si el formulario recolectó información nueva:

```json
POST /ws/rest/v1/patient/<existingPersonUuid>
{
  "person": {
    "names": [...],
    "gender": "F",
    "birthdate": "1986-05-12",
    "attributes": [...],
    "addresses": [...]
  }
}
```

### Responsable ya paciente

No crear `Person` ni `Patient`.

Usar el `person.uuid` del paciente encontrado y guardar solo la relación.

### Responsable proveedor, doctor o usuario del sistema

No crear duplicado automáticamente.

Opciones:

1. Permitir seleccionarlo como responsable si realmente es familiar/acompañante, con etiqueta visible `Personal de salud` o `Proveedor`.
2. Bloquear promoción automática desde resultados marcados como proveedor/staff.
3. Si el proveedor realmente será atendido como paciente, exigir confirmación explícita y preferiblemente registrar por documento verificado.

## Alternativa descartada parcialmente: paciente provisional

Crear todo responsable como `Patient` provisional simplifica documentos porque permite usar `PatientIdentifier`, pero tiene costos:

- aparece en búsqueda global de pacientes;
- puede aparecer en módulos clínicos;
- puede contaminar reportes de pacientes registrados;
- puede recibir visitas/encounters por error;
- exige filtros o badges en todo el sistema;
- requiere definir cuándo deja de ser provisional.

Esta alternativa solo debe usarse si el flujo operativo decide que todo responsable registrado es una preadmisión clínica real. Si se usa, debe incluir:

- identificador provisional separado de historia clínica real;
- flag `responsible_only` o `pre_admission`;
- ocultamiento o etiquetado en búsqueda global;
- reglas para excluir de métricas clínicas;
- transición clara a paciente activo.

## Documentos civiles del responsable

### Problema

No existe un `PersonIdentifier` nativo equivalente a `PatientIdentifier`.

Guardar:

```text
documentType = CE
documentNumber = 123456789
```

es frágil porque:

- representa un solo documento;
- se puede desincronizar tipo y número;
- no soporta múltiples documentos;
- no modela país emisor;
- no modela documento preferido;
- no modela vigencia;
- complica auditoría.

### Estado actual de `sihsalus-content`

En `/Users/duvet05/Downloads/sihsalus-content/configuration/backend_configuration/personattributetypes/personattributetypes.csv` no existen hoy atributos de persona para documento civil. Los atributos existentes cubren teléfono, celular, email, filiación administrativa, seguro, historia clínica, no identificado, responsable de emergencia, estado de identificación, PNS, etc.

En cambio, `/Users/duvet05/Downloads/sihsalus-content/configuration/backend_configuration/patientidentifiertypes/patientidentifiertypes.csv` ya tiene tipos de identificador de paciente para:

- `DNI`, con regex `^[0-9]{8}$` y unicidad `UNIQUE`;
- `CE`, con regex `^[A-Za-z0-9]{6,12}$` y unicidad `UNIQUE`;
- `PASS`, con regex `^[A-Za-z0-9]{6,9}$` y unicidad `UNIQUE`;
- `DIE`, sin validación específica y `NON_UNIQUE`;
- `CNV`, con regex `^[0-9]{12}$` y unicidad `UNIQUE`.

Eso significa que la validación fuerte por regex ya existe para `PatientIdentifierType`, pero no para datos de documento guardados como `PersonAttribute`.

### Recomendación pragmática ajustada

Para el alcance inmediato, agregar en `sihsalus-content` atributos de persona para el documento primario de admisión/responsable:

1. `Tipo de documento de identidad`
   - `Format`: `org.openmrs.Concept`
   - `Foreign`: set de conceptos de tipos de documento (`DNI`, `CE`, `PASS`, `DIE`, `CNV`, `SIN DOCUMENTO` si se decide)
   - `Searchable`: `true` si la búsqueda por atributo codificado funciona correctamente en el backend instalado.

2. `Número de documento de identidad`
   - `Format`: `java.lang.String`
   - `Searchable`: `true`
   - Se guarda normalizado: sin espacios ni guiones, mayúsculas para documentos alfanuméricos.

3. `Estado de verificación de identidad`
   - Preferible `Format`: `org.openmrs.Concept`
   - Valores sugeridos: `No verificado`, `Validado por RENIEC`, `Validado localmente`, `Conflicto`, `No aplica`.

4. `Fuente de verificación de identidad`
   - Opcional, `Format`: `org.openmrs.Concept` o `java.lang.String`
   - Valores: `RENIEC`, `SIS`, `Operador`, `Carga CSV`, `Migraciones`, `Desconocido`.

5. `Fecha/hora de verificación de identidad`
   - Opcional, `Format`: `java.lang.String` con ISO 8601.

Este modelo es deliberadamente de "documento primario registrado en admisión", no un repositorio completo de todos los documentos civiles de la persona.

Ventajas:

- encaja con Initializer actual de `personattributetypes.csv`;
- permite usar conceptos para mapear tipo documental;
- permite buscar localmente por número de documento;
- permite saber si el dato vino de RENIEC o de carga CSV/manual;
- permite bloquear edición en UI cuando el dato está validado por RENIEC;
- permite mapear al `PatientIdentifierType` correcto durante promoción.

Limitaciones:

- `PersonAttributeType` no trae columna de regex ni validator como `PatientIdentifierType`;
- la validación de formato para `PersonAttribute` debe vivir en frontend, servicio backend propio o proceso de importación;
- no garantiza unicidad a nivel base de datos;
- con solo un par `tipo + número`, no representa múltiples documentos activos;
- múltiples atributos del mismo tipo pueden existir en OpenMRS, pero el frontend actual suele hidratar atributos como mapa por `attributeType.uuid`, por lo que se perdería semántica si intentamos guardar varios documentos con el mismo par de atributos.

### Si se necesita soportar múltiples documentos reales

Si el requisito es registrar varios documentos simultáneos por persona, el par `Tipo de documento de identidad` + `Número de documento de identidad` deja de ser suficiente. En ese caso hay dos alternativas:

1. Atributos separados por tipo:
   - `Número de DNI`;
   - `Número de carné de extranjería`;
   - `Número de pasaporte`;
   - `Número de documento extranjero`.

   Esto permite varios documentos sin desincronizar tipo/número, pero aumenta metadata y no modela país/vigencia.

2. Crear una entidad custom de documentos de identidad:

```text
person_identity_document
- uuid
- person_uuid
- document_type
- country
- document_number
- preferred
- active
- issued_at
- expires_at
- source
- verified_at
```

No se recomienda para el alcance inmediato salvo que identidad documental sea un dominio central del sistema. La decisión práctica para admisión debe ser: un documento primario para búsqueda/promoción, y los identificadores formales múltiples viven en `PatientIdentifier` cuando la persona ya es paciente.

### Regex y validación backend

La preocupación por regex es correcta. Con el contenido actual:

- los regex existen en `patientidentifiertypes.csv`;
- esos regex se aplican al guardar identificadores de paciente;
- no hay equivalente directo para `PersonAttributeType` en `personattributetypes.csv`.

Por lo tanto, para persona/responsable hay que aplicar defensa en capas:

1. Frontend:
   - DNI: `^[0-9]{8}$`;
   - CE: `^[A-Za-z0-9]{6,12}$`;
   - PASS: `^[A-Za-z0-9]{6,9}$`;
   - CNV: `^[0-9]{12}$`;
   - DIE: validación laxa o configurable.

2. Backend / importador:
   - el webservice RENIEC debe normalizar y validar antes de devolver datos;
   - la carga CSV debe rechazar o marcar filas con formato inválido;
   - si se implementa endpoint propio para guardar responsable, debe aplicar la misma tabla de validación.

3. Promoción:
   - al convertir `Person` en `Patient`, el documento se transforma a `PatientIdentifier`;
   - ahí el backend vuelve a validar con el regex y unicidad de `PatientIdentifierType`.

Sin endpoint/backend propio, OpenMRS REST estándar no puede garantizar por sí solo que un `PersonAttribute` tipo `Número de documento de identidad` cumpla regex.

### Datos RENIEC no editables

Si el documento y los datos demográficos fueron validados por RENIEC, la UI debe tratarlos como bloqueados:

- tipo de documento;
- número de documento;
- nombres;
- apellidos;
- sexo;
- fecha de nacimiento.

Pero hay que distinguir control UX de control backend:

- En frontend se puede bloquear edición cuando `Estado de verificación de identidad = Validado por RENIEC`.
- En OpenMRS estándar no hay una regla dinámica que diga "si este atributo está validado por RENIEC, no permitas editar nombres/género/fecha/documento".
- `PersonAttributeType.editPrivilege` puede restringir edición de un atributo, pero no nombres, sexo o fecha de nacimiento, y no es condicional al estado RENIEC.
- Si se requiere garantía fuerte, hace falta endpoint propio, interceptor, módulo backend o política de auditoría que rechace cambios sobre identidad RENIEC salvo privilegio especial.

Regla recomendada:

- datos RENIEC bloqueados por defecto en UI;
- acción explícita `Corregir datos validados` solo para usuarios con privilegio administrativo;
- todo cambio sobre identidad RENIEC debe dejar auditoría y motivo;
- una corrección no debe sobrescribir el payload original RENIEC; debe conservarse al menos fuente, fecha/hora y usuario que aceptó/corrigió.

## Integración con RENIEC

### Qué debe hacer RENIEC

RENIEC debe usarse para:

- validar DNI peruano;
- completar o confirmar nombres legales;
- confirmar sexo administrativo si el servicio lo expone;
- confirmar fecha de nacimiento si el servicio lo expone;
- reducir duplicados cuando un DNI coincide con un paciente o persona existente;
- detectar discrepancias entre lo ingresado manualmente y lo devuelto por fuente oficial.

### Qué no debe hacer RENIEC

RENIEC no debe:

- crear pacientes automáticamente;
- promocionar personas automáticamente;
- sobrescribir datos locales sin confirmación;
- bloquear registros cuando el servicio está caído;
- validar CE o pasaporte;
- resolver casos sin documento.

### Flujo con DNI para paciente nuevo

1. Usuario ingresa DNI.
2. Se busca localmente por `PatientIdentifier` DNI.
3. Si existe paciente, se propone abrir paciente existente.
4. Si no existe paciente, se busca `Person` por:
   - `Tipo de documento de identidad = DNI`;
   - `Número de documento de identidad = <DNI normalizado>`.
5. Si existe persona no paciente, se propone promocionar.
6. Si no existe localmente, se consulta RENIEC.
7. Si RENIEC responde, se precargan datos y se marca como verificado.
8. Al guardar:
   - paciente nuevo: crear `Patient` con DNI + historia clínica;
   - persona existente: promover `Person` con DNI + historia clínica.

### Flujo con DNI para responsable

1. Usuario ingresa DNI del responsable.
2. Buscar paciente por identificador DNI.
3. Buscar persona por:
   - `Tipo de documento de identidad = DNI`;
   - `Número de documento de identidad = <DNI normalizado>`.
4. Consultar RENIEC si el feature flag está activo y el servicio existe.
5. Si existe paciente, vincular paciente como responsable.
6. Si existe persona, vincular persona como responsable.
7. Si no existe, crear persona con los atributos de documento y estado de verificación.
8. No crear paciente solo por tener DNI.

### Búsqueda local y RENIEC en la sección 0

La sección `Validación de identidad y seguro` no debe ser solamente "Consulta RENIEC". Debe resolver primero si la persona ya existe en la base local y luego, si corresponde, validar contra RENIEC.

Orden recomendado:

1. Normalizar tipo y número de documento.
2. Buscar `Patient` por `PatientIdentifierType` cuando el documento ya existe como identificador de paciente.
3. Buscar `Person` por `Tipo de documento de identidad` + `Número de documento de identidad`.
4. Si el tipo es DNI y RENIEC está habilitado, consultar RENIEC.
5. Reconciliar resultados:
   - `Patient` local coincide: abrir o reutilizar paciente, no crear otro.
   - `Person` local coincide y RENIEC coincide: cargar persona, completar datos faltantes y marcar/bloquear como verificado.
   - `Person` local coincide y RENIEC difiere: mostrar conflicto, no sobrescribir.
   - No hay local y RENIEC responde: precargar nuevo registro con estado `Validado por RENIEC`.
   - No hay local y RENIEC no responde: permitir registro manual con estado `No verificado`.

Texto de acción recomendado: `Buscar/validar identidad`. Es más correcto que `Consulta RENIEC` porque cubre base local, RENIEC y modo manual cuando no hay internet.

### RENIEC caído

El sistema debe permitir continuar con advertencia:

- `RENIEC no disponible. Registre los datos manualmente y marque identidad como no verificada.`

Debe quedar trazabilidad:

- intento de consulta;
- fecha/hora;
- estado `failed`, `timeout`, `not_found`, `unavailable`;
- usuario que continuó manualmente.

### RENIEC devuelve datos distintos

Casos:

- DNI existe localmente con nombre distinto.
- DNI ingresado apunta a otra persona según RENIEC.
- Fecha de nacimiento difiere.
- Sexo difiere.
- Nombre local tiene errores ortográficos.

Regla:

- No sobrescribir silenciosamente.
- Mostrar comparación.
- Exigir decisión humana: mantener local, actualizar desde RENIEC, registrar observación.
- Si el DNI pertenece a otro paciente existente, bloquear creación duplicada salvo flujo de corrección autorizado.

## Integración con SIS

SIS debe tratarse como fuente de seguro/acreditación, no como fuente primaria universal de identidad.

Flujo recomendado:

1. DNI confirmado o ingresado.
2. Consultar SIS.
3. Precargar:
   - tipo de seguro;
   - código de seguro;
   - estado de acreditación;
   - fecha de consulta;
   - fuente.
4. Si SIS no responde, no bloquear registro.
5. Si SIS responde con datos de otra persona, bloquear aplicación automática y mostrar discrepancia.

Edge importante: persona con CE/pasaporte puede no tener consulta SIS por DNI. El formulario debe permitir seguro manual si aplica.

## Búsqueda y deduplicación

### Búsqueda global de pacientes

Debe seguir usando solo `/patient`.

Objetivo:

- mostrar pacientes reales;
- evitar que responsables no atendidos aparezcan como si fueran pacientes;
- mantener módulos clínicos limpios.

### Búsqueda de responsable

Debe buscar:

- pacientes por `/patient?q=...`;
- personas por `/person?q=...`;
- opcionalmente proveedores por `/provider?q=...` para etiquetar resultados;
- opcionalmente usuarios si el backend lo permite y los privilegios son correctos.

Debe deduplicar por `person.uuid`.

### Búsqueda de persona para promoción

Debe buscar en tres capas:

1. Documento fuerte:
   - paciente por identificador;
   - persona por atributo documental;
   - RENIEC si DNI.
2. Coincidencia media:
   - nombre + fecha nacimiento;
   - nombre + edad + sexo;
   - nombre + teléfono.
3. Coincidencia débil:
   - solo nombre/apellidos.

Las coincidencias débiles nunca deben autopromover.

### Etiquetas visuales obligatorias

Cada resultado debe indicar:

- `Paciente`;
- `Persona registrada`;
- `Personal de salud` / `Proveedor`;
- `Usuario del sistema` si se puede detectar;
- `Posible duplicado`;
- `Documento verificado`;
- `Documento no verificado`;
- `Fallecido` si aplica;
- `Menor de edad` si aplica.

## Proveedores, doctores y usuarios como `Person`

OpenMRS modela proveedores y usuarios sobre personas. Por eso `/person?q=...` puede devolver:

- un médico que es provider;
- una enfermera que es user/provider;
- un usuario administrativo;
- una persona familiar no paciente;
- un paciente, porque todo paciente también es persona.

### Riesgos

1. El usuario busca responsable por nombre y selecciona al doctor equivocado.
2. El sistema promociona un provider a paciente por coincidencia de nombre.
3. El sistema crea duplicado de un doctor que ya existía como `Person`.
4. Un doctor realmente es familiar/responsable de un paciente, pero el sistema lo bloquea demasiado.
5. Un doctor luego se atiende como paciente y debe poder ser paciente sin perder su provider/user.

### Regla recomendada

- Selección como responsable: permitida con etiqueta y confirmación si es provider/user.
- Promoción a paciente: permitida solo con confirmación explícita y preferiblemente documento validado.
- Creación duplicada de persona con mismo nombre que provider: advertir antes de crear.
- Búsqueda global de pacientes: solo mostrará al doctor si ya fue promovido/creado como paciente.

### Detección propuesta

Cuando se busquen personas para responsable/promoción:

1. Ejecutar búsqueda por pacientes.
2. Ejecutar búsqueda por personas.
3. Ejecutar búsqueda por proveedores si el backend lo permite.
4. Cruzar `provider.person.uuid` con resultados de persona.
5. Marcar `isProvider`.
6. Si existe endpoint/privilegio para usuarios, cruzar `user.person.uuid` y marcar `isUser`.

Si no se puede consultar provider/user por permisos, no bloquear. Mostrar solo lo conocido.

## Estados de identidad

Se recomienda modelar estado de identidad del paciente/persona, al menos conceptualmente:

- `unverified`: datos ingresados manualmente.
- `verified_reniec`: DNI confirmado por RENIEC.
- `verified_local`: confirmado por documento físico u operador.
- `conflict`: hay discrepancia con fuente externa o duplicado.
- `unknown`: persona sin documento o no identificada.

Para paciente, esto puede ser `PersonAttribute` o `Obs` administrativo según decisión local. Para responsable no paciente, debe ser `PersonAttribute` si se persiste.

## Flujos de uso

### UC-01: Paciente adulto nuevo con DNI validado por RENIEC

1. Ingresar DNI.
2. Buscar paciente por DNI.
3. Buscar persona por DNI attribute.
4. Consultar RENIEC.
5. Precargar datos.
6. Crear paciente con historia clínica y DNI.

Resultado esperado:

- aparece en búsqueda global de pacientes;
- tiene historia clínica;
- tiene DNI como `PatientIdentifier`;
- no crea `Person` duplicada.

### UC-02: Paciente adulto nuevo sin DNI

1. Usuario registra nombres, sexo, fecha aproximada o exacta.
2. Se genera historia clínica o código temporal según configuración.
3. No se consulta RENIEC.

Resultado esperado:

- paciente creado;
- identidad marcada como no verificada o pendiente;
- se puede agregar DNI/CE/pasaporte después.

### UC-03: Paciente menor con responsable nuevo sin documento

1. Registrar paciente menor.
2. Formulario exige responsable.
3. Crear responsable como `Person`.
4. Guardar relación.

Resultado esperado:

- responsable no aparece en búsqueda global de pacientes;
- responsable aparece en búsqueda de personas/responsables;
- relación queda visible en banner/admisión si el módulo la consulta.

### UC-04: Paciente menor con responsable ya paciente

1. Buscar responsable.
2. Resultado aparece como `Paciente`.
3. Seleccionar.
4. Guardar relación.

Resultado esperado:

- no se crea persona nueva;
- no se crea paciente nuevo;
- se usa mismo `person.uuid`.

### UC-05: Responsable creado como `Person` luego viene como paciente

1. En admisión se busca por documento, nombre o teléfono.
2. Aparece resultado `Persona registrada`.
3. Usuario selecciona `Registrar como paciente`.
4. Se precargan datos de persona.
5. Se agregan identificadores de paciente.
6. Se guarda promoción.

Resultado esperado:

- el UUID del paciente final es el mismo de la persona;
- relaciones previas siguen apuntando a la misma persona;
- la persona ahora aparece en búsqueda global de pacientes;
- no hay duplicado.

### UC-06: Responsable con CE

1. Registrar documento tipo CE.
2. No consultar RENIEC.
3. Buscar duplicados locales por atributo `foreignResidentCardNumber`.
4. Crear o seleccionar persona.
5. Si luego se atiende, mapear CE a `PatientIdentifier` tipo CE.

Resultado esperado:

- CE no se pierde;
- no se fuerza DNI;
- si tiene también pasaporte, ambos pueden coexistir si se usan atributos por tipo.

### UC-07: Responsable con más de un documento

Ejemplo:

- DNI peruano;
- pasaporte;
- CE antiguo.

Resultado esperado:

- no usar `documentType/documentNumber`;
- guardar cada número en atributo específico;
- al promover, crear múltiples identificadores si aplica y elegir uno preferido según configuración.

### UC-08: Doctor existente seleccionado como responsable

1. Buscar nombre del doctor.
2. Resultado aparece como `Personal de salud`.
3. Usuario confirma selección como responsable.
4. Guardar relación.

Resultado esperado:

- no se crea duplicado;
- no se convierte en paciente;
- queda trazable que se seleccionó una persona existente marcada como provider.

### UC-09: Doctor existente se atiende como paciente

1. Buscar por documento fuerte.
2. Resultado aparece como provider/person.
3. Usuario elige `Registrar como paciente`.
4. Confirmación explícita.
5. Promover.

Resultado esperado:

- el doctor conserva su relación como provider/user;
- ahora también es paciente;
- no se crea persona duplicada.

### UC-10: RENIEC devuelve persona distinta a la local

1. DNI ingresado coincide con persona local A.
2. RENIEC devuelve datos incompatibles con A.
3. Mostrar conflicto.
4. Bloquear autocompletado y creación automática.

Resultado esperado:

- no se sobreescribe silenciosamente;
- usuario debe resolver el conflicto.

### UC-11: SIS devuelve seguro para paciente con identidad no verificada

1. DNI ingresado manualmente.
2. RENIEC no disponible.
3. SIS responde.
4. Mostrar que seguro fue consultado, pero identidad sigue no verificada.

Resultado esperado:

- seguro puede quedar registrado;
- estado de identidad no se marca como RENIEC verificado.

### UC-12: Registro offline

1. Sin conexión.
2. Usuario intenta buscar persona existente o consultar RENIEC.
3. Sistema no puede confirmar duplicados.

Resultado esperado:

- permitir solo creación de paciente offline según reglas existentes;
- evitar promoción offline;
- mostrar advertencia de posible duplicado;
- en sincronización, si hay conflicto, detener y pedir resolución.

## Casos de prueba funcionales

### Identidad de paciente

| ID | Caso | Precondición | Acción | Resultado esperado |
| --- | --- | --- | --- | --- |
| F-001 | DNI nuevo validado | DNI no existe localmente | Consultar RENIEC y guardar | Crea paciente con DNI e HC |
| F-002 | DNI ya paciente | Existe `PatientIdentifier` DNI | Ingresar DNI | Sugiere abrir paciente existente |
| F-003 | DNI ya persona | Existe `Person` con atributo DNI | Ingresar DNI | Sugiere promocionar persona |
| F-004 | DNI local conflictivo | DNI en persona local con nombre distinto | Consultar RENIEC | Muestra conflicto |
| F-005 | DNI inválido | DNI no tiene 8 dígitos o check local falla si aplica | Consultar | Bloquea consulta |
| F-006 | Sin DNI | Paciente sin documento | Guardar | Crea paciente sin DNI, con identificador configurado |
| F-007 | CE | Paciente extranjero | Guardar CE | Crea identificador CE, no RENIEC |
| F-008 | Pasaporte | Paciente extranjero/turista | Guardar pasaporte | Crea identificador pasaporte |
| F-009 | DNI + HC | Paciente con DNI y autogenerado | Guardar | HC preferida si configuración lo define |
| F-010 | Documento duplicado | Mismo documento en otro paciente | Guardar | Backend o frontend bloquea duplicado |

### Responsable

| ID | Caso | Precondición | Acción | Resultado esperado |
| --- | --- | --- | --- | --- |
| R-001 | Responsable nuevo sin doc | Paciente menor | Crear responsable | Crea `Person`, no `Patient` |
| R-002 | Responsable nuevo con DNI | RENIEC disponible | Consultar y crear | Crea `Person` con DNI attribute verificado |
| R-003 | Responsable nuevo con CE | CE no existe localmente | Crear | Crea `Person` con CE attribute |
| R-004 | Responsable ya paciente | Existe paciente | Seleccionar | Relación al `person.uuid` existente |
| R-005 | Responsable ya persona | Existe persona no paciente | Seleccionar | Relación al `person.uuid` existente |
| R-006 | Responsable menor para menor | Persona tiene edad < 18 | Seleccionar | Bloquea o advierte según regla |
| R-007 | Responsable institución | No es persona natural | Crear/seleccionar | Permite si relación/config lo acepta |
| R-008 | Responsable sin sexo | Datos incompletos | Crear | Bloquea si backend requiere sexo |
| R-009 | Responsable sin relación | Tipo relación no seleccionado | Crear | Bloquea creación para evitar persona huérfana |
| R-010 | Responsable duplicado por nombre | Nombre similar existente | Crear | Advierte antes de crear |

### Promoción

| ID | Caso | Precondición | Acción | Resultado esperado |
| --- | --- | --- | --- | --- |
| P-001 | Promoción básica | Existe `Person` no paciente | Promover con HC | Crea `Patient` mismo UUID |
| P-002 | Promoción con DNI | Person tiene `dniNumber` | Promover | Crea DNI `PatientIdentifier` |
| P-003 | Promoción con CE | Person tiene CE | Promover | Crea CE `PatientIdentifier` |
| P-004 | Promoción con múltiples docs | Person tiene DNI y pasaporte | Promover | Crea identificadores configurados |
| P-005 | Promoción sin doc | Person sin documento | Promover | Crea HC o temporal |
| P-006 | Promoción de provider | Person es provider | Promover con confirmación | Conserva provider y crea patient |
| P-007 | Promoción concurrente | Dos usuarios promueven mismo person | Guardar ambos | Uno gana, otro recibe conflicto/ya paciente |
| P-008 | Promoción de persona fallecida | Person dead=true | Promover | Bloquea salvo permiso especial |
| P-009 | Promoción offline | Sin conexión | Intentar promover | No permitido |
| P-010 | Promoción con relación previa | Person responsable de otro paciente | Promover | Relación previa se conserva |

### RENIEC

| ID | Caso | Precondición | Acción | Resultado esperado |
| --- | --- | --- | --- | --- |
| N-001 | RENIEC éxito | DNI válido | Consultar | Precarga datos con estado verificado |
| N-002 | RENIEC no encontrado | DNI válido sin respuesta | Consultar | Permite manual con advertencia |
| N-003 | RENIEC timeout | Servicio lento | Consultar | Timeout controlado, no bloquea registro |
| N-004 | RENIEC caída | Servicio 5xx | Consultar | Muestra error recuperable |
| N-005 | RENIEC nombre distinto | Local existe con otro nombre | Consultar | Muestra comparación y conflicto |
| N-006 | RENIEC fecha distinta | Fecha local distinta | Consultar | No sobrescribe sin confirmación |
| N-007 | RENIEC sexo distinto | Sexo local distinto | Consultar | No sobrescribe sin confirmación |
| N-008 | RENIEC en responsable | Responsable con DNI | Consultar | Crea/actualiza `Person`, no `Patient` |
| N-009 | RENIEC repetido | Misma consulta dos veces | Consultar | No duplica atributos ni eventos |
| N-010 | RENIEC sin permisos | Usuario sin privilegio | Consultar | Bloquea con mensaje claro |

### SIS

| ID | Caso | Precondición | Acción | Resultado esperado |
| --- | --- | --- | --- | --- |
| S-001 | SIS activo | DNI válido | Consultar SIS | Precarga seguro/acreditación |
| S-002 | SIS inactivo | DNI válido | Consultar SIS | Guarda estado no acreditado si usuario confirma |
| S-003 | SIS caído | Servicio 5xx | Consultar SIS | No bloquea registro |
| S-004 | SIS mismatch | Respuesta difiere de RENIEC | Consultar SIS | Muestra conflicto |
| S-005 | SIS sin DNI | CE/pasaporte | Consultar | No consulta o pide datos requeridos |
| S-006 | SIS responsable | Responsable no paciente | Consultar | No crear paciente; opcional guardar seguro en persona si negocio lo exige |

### Proveedores, doctores y usuarios

| ID | Caso | Precondición | Acción | Resultado esperado |
| --- | --- | --- | --- | --- |
| D-001 | Doctor aparece en `/person` | Provider existente | Buscar responsable | Resultado marcado como personal de salud |
| D-002 | Doctor mismo nombre que familiar | Dos personas similares | Buscar | Muestra ambos con etiquetas |
| D-003 | Seleccionar doctor responsable | Doctor es familiar real | Seleccionar | Permite con confirmación |
| D-004 | Crear duplicado de doctor | Nombre coincide provider | Crear persona nueva | Advierte posible duplicado |
| D-005 | Promover doctor | Doctor requiere atención | Promover | Exige documento/confirmación |
| D-006 | Doctor ya paciente | Provider también Patient | Buscar global | Aparece como paciente |
| D-007 | Usuario administrativo | User Person | Buscar responsable | Etiqueta si se puede detectar |
| D-008 | Sin permiso para users | Endpoint users restringido | Buscar | No falla flujo; omite etiqueta user |

## Casos de prueba técnicos

### Unit tests

1. `fetchPerson` deduplica paciente y persona por `person.uuid`.
2. `fetchPerson` preserva `uuid` de persona, no `patient.uuid` si el paciente trae `person.uuid`.
3. `buildResponsiblePersonPayload` no incluye identificadores de paciente.
4. `buildResponsiblePersonPayload` permite atributos documentales separados por tipo si se implementan.
5. Validación bloquea responsable menor cuando el paciente menor requiere adulto.
6. Validación no exige DNI/CE para responsable.
7. Validación permite CE/pasaporte con reglas configurables.
8. Promoción arma payload con `person: existingPersonUuid`, no `person: { uuid: ... }` si se usa el modo recomendado REST.
9. Promoción no genera nuevo `v4()` cuando viene de persona existente.
10. Promoción mapea `dniNumber` a identifier type DNI.
11. Promoción mapea `foreignResidentCardNumber` a identifier type CE.
12. Promoción no crea identificadores duplicados si la persona ya fue promovida.

### Integration tests con mock backend

1. Crear paciente nuevo normal.
2. Crear responsable como persona.
3. Crear relación entre paciente y persona.
4. Buscar responsable por nombre y devolver persona.
5. Promover persona con historia clínica.
6. Verificar que la relación previa sigue apuntando al mismo UUID.
7. Buscar globalmente y verificar que antes de promoción no aparece; después sí aparece.
8. Buscar doctor provider y marcarlo como provider.
9. RENIEC éxito precarga datos.
10. RENIEC error deja continuar manual.
11. SIS éxito precarga seguro.
12. SIS error deja continuar.

### E2E

1. Registrar menor con responsable nuevo.
2. Confirmar que responsable no aparece en búsqueda global de pacientes.
3. Iniciar registro de paciente y buscar ese responsable como persona existente.
4. Promoverlo.
5. Confirmar que aparece en búsqueda global.
6. Confirmar que el paciente menor todavía muestra la relación.
7. Registrar responsable con CE.
8. Promoverlo y confirmar CE como identificador de paciente.
9. Buscar provider por nombre y confirmar etiqueta.
10. Intentar promoción offline y confirmar bloqueo.

### Backend read-only checks

Estos comandos no crean datos:

```bash
curl -u "$E2E_USER_ADMIN_USERNAME:$E2E_USER_ADMIN_PASSWORD" \
  "$E2E_API_BASE_URL/ws/rest/v1/patient/<uuid>?v=custom:(uuid,person:(uuid),identifiers:(uuid))"
```

Validar:

- `patient.uuid == patient.person.uuid`;
- existe `identifiers`;
- no se exponen datos sensibles en logs.

```bash
curl -u "$E2E_USER_ADMIN_USERNAME:$E2E_USER_ADMIN_PASSWORD" \
  "$E2E_API_BASE_URL/ws/rest/v1/person/<uuid>?v=custom:(uuid,display,attributes:(uuid,attributeType:(uuid,display),value),addresses:(uuid,preferred,address1))"
```

Validar:

- persona existe antes de promoción;
- atributos/documentos se leen;
- direcciones se leen.

## Edge cases críticos

### Identidad y documentos

- Persona con DNI y CE.
- Persona con DNI y pasaporte.
- Persona con CE vencido y pasaporte vigente.
- Persona nacionalizada: antes CE, luego DNI.
- Persona con DNI mal digitado, luego corregido.
- Documento compartido por error entre dos personas.
- Documento en paciente fallecido.
- Documento en persona staff.
- Documento en persona no paciente.
- Documento sin país emisor.
- Documento con ceros iniciales.
- Documento con letras.
- Pasaporte con caracteres especiales.
- CE con longitud variable.
- Duplicado por normalización: espacios, guiones, mayúsculas/minúsculas.

### Personas y duplicados

- Misma persona creada como responsable dos veces.
- Persona creada como responsable y luego como paciente desde cero.
- Persona ya paciente seleccionada como responsable.
- Persona no paciente seleccionada como responsable.
- Doctor/persona staff seleccionada por error.
- Usuario del sistema con mismo nombre que paciente.
- Persona fallecida aparece en búsqueda.
- Persona voided aparece en búsqueda.
- Persona con nombre incompleto.
- Persona sin fecha de nacimiento.
- Persona sin sexo.
- Persona con edad estimada.
- Persona institución como SAMU, PNP, Fiscalía, albergue.

### Promoción

- Promoción sin identificador por falta de source.
- Promoción con identifier source caído.
- Promoción con identifier type requerido no cargado.
- Promoción con location vacía.
- Promoción concurrente por dos operadores.
- Promoción de persona que ya fue promovida entre búsqueda y submit.
- Promoción de provider.
- Promoción de usuario.
- Promoción de persona voided.
- Promoción de persona con relación activa a varios pacientes.
- Promoción con datos RENIEC que difieren de persona local.

### RENIEC/SIS

- RENIEC responde lento.
- RENIEC no responde.
- RENIEC responde 404/no encontrado.
- RENIEC responde datos parciales.
- RENIEC responde con encoding raro o nombres compuestos.
- RENIEC cambia apellidos por normalización.
- RENIEC no disponible pero SIS sí.
- SIS disponible pero RENIEC no.
- SIS con seguro activo pero nombre diferente.
- SIS con estado vencido.
- SIS devuelve múltiples afiliaciones.
- Usuario consulta RENIEC y luego modifica datos manualmente.

### Offline

- Registrar paciente offline con responsable nuevo.
- Intentar buscar persona offline.
- Intentar promover offline.
- Sincronizar offline y encontrar duplicado online.
- Sincronizar offline y RENIEC ahora dice que DNI pertenece a otro.
- Sincronizar offline y persona fue promovida por otro usuario.

### Seguridad y privacidad

- No imprimir DNI/CE/pasaporte en logs.
- No exponer credenciales de RENIEC/SIS al frontend si el servicio debe pasar por backend.
- Auditar quién aceptó una discrepancia RENIEC.
- Auditar quién promocionó una persona a paciente.
- Restringir promoción de provider/user si la política lo exige.
- Evitar que usuario sin privilegios busque datos de staff si no corresponde.

## Reglas de decisión

### Cuándo crear `Person`

Crear `Person` cuando:

- la persona solo acompaña o representa al paciente;
- no será atendida en ese momento;
- no se necesita historia clínica;
- no se debe mostrar en búsqueda global de pacientes.

### Cuándo crear `Patient`

Crear `Patient` cuando:

- la persona recibirá atención;
- se abrirá historia clínica;
- se necesita visita/encounter/orden/diagnóstico;
- debe aparecer en módulos clínicos.

### Cuándo promover

Promover cuando:

- ya existe una `Person`;
- se confirma que esa persona será atendida;
- se requiere historia clínica o identificadores de paciente;
- se confirma por documento fuerte o por selección humana confiable.

### Cuándo bloquear

Bloquear cuando:

- documento ya pertenece a otro paciente activo;
- se intenta promover offline;
- se intenta crear responsable sin relación;
- el responsable requerido para menor no cumple regla de edad;
- RENIEC/SIS evidencia conflicto fuerte y no hay permiso para resolverlo;
- se intenta autopromover provider/user sin confirmación.

## UX recomendada

### Resultado de búsqueda

Cada fila debe mostrar:

```text
Maria Quispe
Persona registrada | DNI no verificado | 38 años | F | Tel. 987654321
Acciones: Seleccionar como responsable | Registrar como paciente
```

Para paciente:

```text
Maria Quispe
Paciente | HC 000123 | DNI verificado | 38 años | F
Acciones: Seleccionar como responsable | Abrir paciente
```

Para provider:

```text
Dra. Maria Quispe
Personal de salud | No paciente | 42 años | F
Acciones: Seleccionar como responsable | Registrar como paciente
Advertencia: Esta persona pertenece al personal de salud.
```

### Confirmación de promoción

Texto sugerido:

```text
Esta persona está registrada en OpenMRS, pero todavía no es paciente.
Al continuar, se creará una historia clínica para la misma persona y aparecerá en la búsqueda de pacientes.
Las relaciones existentes se conservarán.
```

Para provider:

```text
Esta persona está registrada como personal de salud/proveedor.
Solo continúe si la persona será atendida como paciente.
No se creará un duplicado; se reutilizará la misma persona.
```

### Discrepancia RENIEC

Mostrar tabla:

| Campo | Local | RENIEC |
| --- | --- | --- |
| Nombres | Maria Luisa | Maria L. |
| Apellido paterno | Quispe | Quispe |
| Fecha nacimiento | 1986-01-01 estimada | 1986-05-12 |

Acciones:

- Usar datos RENIEC;
- Mantener datos locales;
- Cancelar;
- Marcar conflicto.

## Cambios técnicos necesarios

### Fase 1: documentación y protecciones

- Documentar este flujo.
- Mantener responsable como `Person`.
- No agregar DNI/CE como `PatientIdentifier` a `Person`.
- Añadir tests que aseguren que responsable nuevo no llama `/patient`.
- Etiquetar en código que `/person?q` puede traer providers/users.

### Fase 2: búsqueda robusta para responsable

- Enriquecer `fetchPerson` con tipo de resultado:
  - `patient`;
  - `person`;
  - `provider`;
  - `user` si es posible.
- Deducir provider cruzando contra `/provider?q`.
- Mantener deduplicación por `person.uuid`.
- Mostrar etiquetas.
- Confirmar selección de provider/user.

### Fase 3: documentos de responsable

- Definir atributos configurables:
  - `responsibleDniAttributeTypeUuid`;
  - `responsibleForeignResidentCardAttributeTypeUuid`;
  - `responsiblePassportAttributeTypeUuid`.
- Validar formato por tipo.
- Buscar duplicados por atributo si OpenMRS lo soporta bien con `searchable`.
- No usar par `documentType/documentNumber` como persistencia primaria.

### Fase 4: promoción

- Agregar modo `personUuidToPromote`.
- Inicializar formulario desde `/person/{uuid}`.
- En submit:
  - si nuevo normal: payload actual;
  - si promoción: `POST /patient` con `person: existingPersonUuid`, `identifiers`.
- Luego actualizar persona/patient si hay cambios demográficos.
- Bloquear offline.
- Manejar conflicto `already patient`.

### Fase 5: RENIEC/SIS

- Pasar llamadas externas por backend o recurso seguro.
- Guardar estado de verificación.
- Manejar discrepancias.
- Integrar con búsqueda local antes de crear.
- No bloquear ante caídas.

## Criterios de aceptación

1. Un responsable nuevo sin atención se guarda como `Person`, no como `Patient`.
2. El responsable no aparece en la búsqueda global de pacientes.
3. El responsable sí aparece en búsqueda de responsable/persona.
4. Si el responsable luego se atiende, puede promocionarse sin crear duplicado.
5. La promoción conserva el mismo UUID.
6. Las relaciones previas siguen funcionando después de la promoción.
7. Un doctor/provider puede seleccionarse como responsable con confirmación, sin crear duplicado.
8. Un doctor/provider puede convertirse en paciente solo con confirmación explícita.
9. RENIEC nunca crea ni promociona automáticamente.
10. SIS no marca identidad como verificada por RENIEC.
11. CE y pasaporte no dependen de RENIEC.
12. Una persona puede tener más de un documento civil.
13. No se guarda `documentType/documentNumber` como par frágil si se necesita soportar múltiples documentos.
14. Offline no permite promoción.
15. Los tests cubren duplicados, provider/person y RENIEC/SIS no disponibles.

## Decisión recomendada

Mantener el modelo OpenMRS:

- `Person` para responsable no atendido.
- `Relationship` para vínculo.
- `Patient` solo cuando hay atención clínica.
- Promoción explícita para convertir `Person` existente en `Patient`.

Implementar atributos documentales separados por tipo como solución intermedia para DNI/CE/pasaporte en responsables no pacientes. No usar `documentType` + `documentNumber` salvo como estado transitorio de UI.

Tratar providers/doctores/users como casos especiales de `Person`: visibles, etiquetados, seleccionables con confirmación, y promocionables solo bajo acción explícita.
