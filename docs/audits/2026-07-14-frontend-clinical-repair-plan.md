# Plan de reparación clínica del frontend — 2026-07-14

## Propósito

Consolidar las correcciones actuales sobre la última versión de `main` y dejar una ruta verificable para desplegar
el frontend sin normalizar datos clínicos incorrectos, ampliar permisos por accidente ni publicar artefactos que no
correspondan al commit validado.

Este documento separa tres clases de trabajo:

- **Frontend:** cambios que pueden resolverse y probarse en este repositorio.
- **Backend/content:** contratos, privilegios, catálogos y operaciones que el frontend no debe inventar.
- **Operación:** configuración protegida, pruebas en un entorno sintético y aprobación del despliegue.

El PR de reparación debe permanecer en borrador mientras cualquiera de los bloqueos de despliegue indicados aquí
siga abierto. Un control visual del navegador mejora la captura, pero no reemplaza validación y autorización en el
backend.

## Principios de seguridad clínica

1. **Fallar cerrado:** si no puede comprobarse estado, privilegio, catálogo o conflicto, no se guarda ni se infiere
   un valor clínico.
2. **No alterar semántica silenciosamente:** un UUID, código o texto no se convierte a otro concepto sin una
   correspondencia aprobada y auditable.
3. **Fecha como calendario local:** nacimiento y atención se comparan por día calendario, sin desplazar el dato por
   UTC o zona horaria.
4. **Defensa en profundidad:** límites HTML, validación del formulario, contrato de API y reglas del backend deben
   coincidir; ninguno sustituye a los demás.
5. **Mínimo privilegio:** ocultar o bloquear una acción en UI no concede autoridad; el backend debe negar la misma
   operación.
6. **Datos sintéticos en automatización:** E2E, capturas y artefactos no pueden usar pacientes reales ni credenciales
   administrativas compartidas.
7. **Cambios reversibles:** desplegar por digest/SHA, conservar evidencia y definir el rollback antes de promover.

## Estado ejecutivo

| Frente                        | Estado del frontend                                                     | Bloqueo fuera del frontend                                                       |
| ----------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Nacimiento y edad en búsqueda | Implementado; pruebas focales posrebase completadas                     | Confirmar que la API aplica límites equivalentes                                 |
| Mensajes clínicos e i18n      | Interpolación React sin entidades visibles y acrónimos preservados      | Smoke visual en español e inglés                                                 |
| Registro y nacionalidad       | Inferencia endurecida, modo no identificado y contrato documentado      | Completar y versionar el catálogo OCL; auditar datos históricos                  |
| Identidad en emergencia       | Documento validado por tipo; `Otros` deshabilitado si el tipo no existe | Crear/aprobar el tipo `Otros` antes de configurarlo                              |
| Citas                         | Ciclo y validaciones endurecidos; suites posrebase completadas          | Hacer atómicos conflicto/estado/guardado y definir capacidad/proveedor           |
| Rutas, modales y workspaces   | Nombres únicos, guard de duplicados y revocación reactiva                | Ninguno para el registro; sí para la matriz RBAC asociada                        |
| RBAC                          | Propagación, doble permiso clínico y bloqueo directo implementados       | Aprobar/asignar matriz de privilegios y probar roles reales                      |
| FUA                           | Endpoint deshabilitado por defecto y HTML aislado/sanitizado            | Publicar un gateway HTTPS mismo origen y validar contrato/roles                  |
| E2E                           | Smoke externo sintético separado del build del PR                       | Crear ambiente, variables, cuenta mínima, revisores y despliegue efímero por SHA |
| Release                       | Fuente, SHA, rama y escaneo previos a publicación                       | Proteger ambientes de preproducción/producción y aprobar promoción               |

## 1. Nacimiento y edad

### Decisión de estándar

No se forzará una migración de librería dentro de esta reparación. El formulario de búsqueda usa React Hook Form con
Zod; registro de paciente usa Formik/Yup. Ambos consumen las mismas reglas canónicas de `@openmrs/esm-utils`:

- edad entera entre 0 y 140 años;
- mes entre 1 y 12;
- día entre 1 y 31, seguido de validación de una fecha posible;
- año dentro del horizonte dinámico de 140 años y no posterior al año actual;
- rechazo de fechas imposibles, futuras o anteriores al límite exacto por día calendario;
- rechazo de signos, exponentes, decimales y pegados no numéricos en campos enteros.

La consistencia clínica se obtiene compartiendo constantes y funciones de calendario, no haciendo que dos
arquitecturas de formularios diferentes usen obligatoriamente la misma biblioteca.

### Trabajo del frontend

- Usar un único `OpenmrsDatePicker`, igual que registro, con límites de calendario entre hoy y la frontera exacta de
  140 años. La búsqueda ya no expone tres cajas capaces de representar una fecha imposible.
- Mantener visible el filtro de edad y distinguir `0` de un valor vacío.
- Aplicar `min`/`max` en el control y repetir la regla en el esquema Zod.
- Mantener la validación defensiva de día/mes/año en el esquema aunque la UI produzca una fecha completa, porque ese
  estado también puede llegar desde integraciones o datos restaurados.
- Calcular límites con calendario local para que un usuario en Lima no cambie de fecha al serializar.
- Alinear mensajes y pruebas con registro de paciente, que conserva Yup por compatibilidad.

### Criterios de aceptación

- El selector no permite fecha futura, fecha inexistente ni una fecha anterior al horizonte; el esquema también
  rechaza día 0 o 32, mes 0 o 13, año de seis dígitos y edad 141.
- El límite de 140 años acepta exactamente el día frontera y rechaza el día anterior.
- Una fecha futura y una fecha inexistente no producen una búsqueda.
- Teclado, pegado, validación de esquema y payload ofrecen el mismo resultado.

## 2. Identidad y nacionalidad

### Contrato

La nacionalidad es un `PersonAttribute` cuyo valor es un concepto. El cliente REST envía el UUID del concepto; la
base de datos OpenMRS almacena el `concept_id` local. No es texto libre, no es el país emisor del documento y no debe
guardarse como código ISO directamente.

El contrato completo, consulta de auditoría y procedimiento de migración están en
`docs/clinical/patient-nationality-concepts.md`.

El contrato de formatos, sus fuentes, brechas con content y el orden seguro de migración están en
`docs/clinical/peru-identity-document-contract.md`.

### Trabajo del frontend

- Cargar las respuestas desde el concept set desplegado.
- Inferir Perú únicamente ante un DNI completo de ocho dígitos y después de comprobar que el concepto Perú forma
  parte del catálogo cargado sin errores y que el usuario tiene permiso de lectura.
- Bloquear el submit de registro general y emergencia mientras un DNI completo sin nacionalidad explícita no pueda
  resolverse contra ese catálogo; repetir el control antes de idgen/POST para cubrir submit por teclado.
- Si existe una nacionalidad previa, bloquear también mientras el catálogo carga, falla o no contiene ese UUID; una
  forma de UUID no sustituye la comprobación de pertenencia.
- No sobrescribir una nacionalidad ya registrada.
- No inferir nacionalidad desde CE, pasaporte, DIE, una fila vacía o un paciente no identificado.
- Al cambiar una admisión de emergencia a paciente no identificado, limpiar documento, fecha de nacimiento y seguro
  antes de construir el payload; los campos ocultos no pueden persistir valores anteriores.
- Al volver de paciente no identificado a conocido, limpiar la edad estimada oculta y no sintetizar una fecha de
  nacimiento desde ella. Una fecha exacta revisada siempre prevalece.
- Normalizar y validar el documento de emergencia según el mismo contrato de tipos que usa registro general; una
  combinación desconocida o inválida no se envía.
- No eliminar letras o truncar valores sobrelongitud hasta convertir un documento distinto en uno aparentemente
  válido; solo se normalizan separadores de presentación y mayúsculas.
- Rechazar UUID duplicados entre tipos de documento y fallar cerrada la nacionalidad si no se pudo comprobar su
  pertenencia al catálogo.
- Fallar de forma visible si el catálogo no carga; no introducir una lista paralela de países.
- Mantener deshabilitado el identificador `Otros` en emergencia mientras el UUID configurado no corresponda a un
  `PatientIdentifierType` realmente desplegado.

### Trabajo de content/datos

- Comparar el set actual con el CodeSystem normativo mediante código alfa-3.
- Preservar UUID existentes, crear conceptos ausentes y corregir etiquetas mediante un bundle OCL versionado.
- Aprobar la unicidad y el formato de un tipo de identificador `Otros` antes de exponerlo.
- Regularizar coordinadamente las brechas CE/pasaporte/DIE entre `PatientIdentifierType`, referencias estatales y
  datos históricos; DIE no puede permanecer sin formato y `NON_UNIQUE` sin una decisión institucional.
- Ejecutar primero la auditoría histórica de solo lectura; valores ambiguos van a revisión manual, no a conversión
  automática.
- Verificar conteos, duplicados activos y respuesta REST después de cualquier migración.

## 3. Formulario de citas

### Trabajo del frontend

- Guardar el UUID del servicio, nunca su nombre visible.
- Cargar subtipo de servicio, conservar valores retirados solo durante una edición existente y validar la combinación.
- Aplicar duración del subtipo o servicio, con fallback explícito de 30 minutos, sin sobrescribir una duración
  personalizada por el usuario.
- No reasignar por defecto proveedores con respuestas `REJECTED` o `TENTATIVE`; excluir `CANCELLED`.
- Enviar al chequeo de conflicto únicamente proveedores realmente asignados.
- Aceptar como “sin conflicto” solo el contrato explícito del backend: `204`, o `200` con un mapa vacío validado.
  Cualquier estado inesperado, error de red o payload no interpretable bloquea el guardado.
- Volver a consultar el estado editable inmediatamente antes de guardar; una cita que cambió de estado falla cerrada.
- Limitar recurrencia a un horizonte máximo de 365 días, periodo positivo, fin posterior al inicio y días de semana
  válidos.
- Mantener aislamiento por paciente en visitas del día: consultar solo los pacientes de la página visible, con
  paginación y concurrencia acotadas.
- No mostrar acciones de visita si su consulta falla o si una respuesta HTTP exitosa no contiene un arreglo
  `results` válido; una respuesta malformada no equivale a “sin visitas”.
- En check-in, validar que la ubicación y el servicio forzados existan en los catálogos cargados; si hay varias
  ubicaciones y ninguna coincide con la sesión, exigir selección explícita en vez de elegir la primera.
- Antes de crear una consulta, confirmar el tipo de atributo usado para el token de idempotencia. Mientras carga,
  ante error, si está ausente o si no está configurado, bloquear el guardado; una correlación explícita de cita debe
  existir también en backend y conserva su contrato propio.

### Dependencias de backend

- Unificar chequeo de conflicto, verificación de estado y persistencia en una operación transaccional o con control
  optimista de versión.
- Aplicar el límite de recurrencia y cantidad también en servidor.
- Definir y hacer cumplir doble reserva de proveedor, capacidad del servicio y zona horaria institucional. El
  endpoint actual no cubre por sí solo todas esas reglas.
- Registrar auditoría de creación, reprogramación, cancelación y transición a visita.
- Desplegar y verificar el `VisitAttributeType` configurado para el token de persistencia antes del frontend. Su
  ausencia bloquea deliberadamente la creación online de consultas para evitar duplicados tras timeouts ambiguos.

### Criterios de aceptación

- Crear, editar, reprogramar y cancelar respetan el estado actual y el servicio/subtipo persistido.
- Una respuesta de conflicto inesperada nunca llega al POST/PUT de guardado.
- Cambiar entre servicios con o sin duración usa 30 minutos cuando corresponde y conserva una duración manual.
- Recurrencias inválidas no se envían; una serie válida muestra conflictos antes de persistir.
- Dos pacientes no comparten accidentalmente una visita por una consulta global o paginación incompleta.
- Una ubicación o cola eliminada de la configuración bloquea el check-in con un mensaje accionable y no llega al
  POST de consulta/cola.
- Un `200` malformado al consultar visitas bloquea check-in y edición en vez de habilitarlos.

## 4. Rutas, modales y workspaces

### Trabajo del frontend

- Usar nombres registrados globalmente únicos y con prefijo del módulo.
- Corregir colisiones entre condiciones, salud materna, CRED y atención ambulatoria.
- Validar las 66 aplicaciones en CI mediante un script determinista.
- Rechazar en runtime un segundo registro con el mismo nombre para modales y workspaces legacy.
- Conservar los nombres nuevos al rebasar las correcciones recientes de CRED ya integradas en `main`.

### Criterios de aceptación

- El validador no encuentra nombres duplicados.
- Abrir una acción desde cada módulo resuelve el modal/workspace de ese módulo.
- Un registro duplicado falla con un error diagnóstico y no reemplaza silenciosamente el componente previo.

## 5. RBAC

### Trabajo del frontend

- Propagar `privileges` desde `routes.json` a extensiones, modales y workspaces.
- Filtrar menú y ventanas por privilegio.
- Volver a validar el privilegio al abrir directamente un modal o workspace, antes de mostrar prompts o mutar estado.
- Dejar de renderizar inmediatamente un workspace clínico ya abierto si la sesión pierde alguno de sus privilegios.
- Exigir en Colas tanto `app:home.colasAtencion.editar` como el permiso clínico propio para abrir Signos Vitales o
  Notas; el botón y el workspace aplican la misma intersección.
- Mantener pruebas de acceso y denegación en workspace legacy, workspace v2 y modal.

### Bloqueo de despliegue

La rama declara privilegios de edición que todavía no tienen una asignación operativa demostrada en los roles del
contenido. No deben concederse de forma amplia para hacer pasar la UI. Antes de promover:

La auditoría de los registros de lanzamiento encontró 12 privilegios sin rol, 37 registros protegidos explícitos y
39 puntos de entrada efectivos:

| Privilegio sin rol                            |                                  Superficies efectivas |
| --------------------------------------------- | -----------------------------------------------------: |
| `app:hoja.clinica.accionesSinConexion.editar` |                                                1 modal |
| `app:hoja.clinica.controlPrenatal.editar`     |                                 1 modal + 3 workspaces |
| `app:hoja.clinica.cred.antecedentes.editar`   |                                 1 modal + 3 workspaces |
| `app:hoja.clinica.cred.cursoVida.editar`      |                             2 workspaces + 1 extensión |
| `app:hoja.clinica.cred.inmunizaciones.editar` |                                            1 workspace |
| `app:hoja.clinica.facturacion.editar`         |                                3 modales + 1 workspace |
| `app:hoja.clinica.historiaSocial.editar`      |                                  1 modal + 1 workspace |
| `app:hoja.clinica.imagenes.editar`            | 5 workspaces + 7 diálogos registrados como extensiones |
| `app:hoja.clinica.odontologia.editar`         |                                            1 workspace |
| `app:home.seguimientoCasos.editar`            |                                           2 workspaces |
| `app:home.libroAtenciones.editar`             |                                          2 extensiones |
| `app:home.listasPacientes.editar`             |          1 ventana que bloquea 2 workspaces y su icono |

Además, Citas protege la edición de la fecha de emisión con `app:appointments.issueDate.edit`. Este privilegio no
forma parte de los registros de lanzamiento de la tabla anterior, pero tampoco tiene una asignación operativa
demostrada: debe incorporarse expresamente a la matriz por rol. Sin él, el campo queda de solo lectura y el payload
conserva la fecha original incluso ante manipulación del DOM; el backend debe aplicar la misma autorización.

El barrido más amplio encontró 27 privilegios `.editar` usados en código productivo sin rol operativo. Los 12 de la
tabla son el bloqueo inmediato del nuevo guard de lanzamiento, pero la matriz clínica debe resolver los 27. La
fusión de pacientes requiere además `app:opciones.fusionarPacientes`, que debe pertenecer a un rol supervisor
separado, no a todos los usuarios clínicos.

1. aprobar una matriz por rol y acción con responsables clínicos y de seguridad;
2. crear/asignar los privilegios en backend/content;
3. desplegar content/backend antes o junto al frontend;
4. probar usuario clínico, admisión, farmacia, laboratorio, caja, administrador y solo lectura;
5. comprobar tanto visibilidad como respuesta backend ante llamada directa.

## 6. FUA y contenido HTML remoto

### Trabajo del frontend

- Dejar vacío el endpoint por defecto; no enviar el identificador FUA a un host externo o a HTTP.
- Admitir solamente un gateway HTTPS de mismo origen; HTTP se limita a loopback para desarrollo local.
- Usar credenciales de mismo origen y política `no-referrer`.
- Sanitizar la respuesta con DOMPurify, retirar scripts, handlers, formularios, navegación y recursos de red.
- Inyectar una CSP restrictiva y renderizar el resultado en un iframe con sandbox vacío.
- No mostrar endpoint, payload ni respuesta cruda en el mensaje de error.

### Criterios de aceptación

- Un endpoint vacío, HTTP no local o cross-origin no realiza ninguna petición.
- HTML con script, iframe, formulario, handler o URL remota queda inerte.
- El visor permite solo contenido estático esperado, incluidas imágenes raster `data:` aprobadas.
- Si el sanitizador no está disponible, se muestra texto escapado y no HTML activo.

## 7. E2E, CI y publicación

### E2E

- Ejecutar solo contra `synthetic-nonprod` y hosts HTTPS incluidos exactamente en la allowlist.
- Usar una cuenta sintética de mínimo privilegio guardada en el environment protegido `e2e-nonprod`.
- Mantener `E2E_USERNAME` y `E2E_PASSWORD` vacíos en la plantilla versionada; los valores se inyectan localmente o
  desde secretos del environment.
- Exponer secretos únicamente al paso de Playwright, no a checkout, instalación ni build.
- Conservar reportes fallidos por tres días y revisar que no contengan datos identificables.
- Rotar o deshabilitar la credencial administrativa que apareció históricamente en scripts y auditar su uso. Eliminarla
  del árbol actual no la elimina del historial Git.

### CI y release

- Ejecutar CI en PR y push tanto para `main` como para `pre-release`.
- Evitar persistir credenciales de checkout en el workspace.
- Publicar únicamente el SHA exacto cuya CI de evento `push` terminó correctamente y que todavía es la punta de la
  rama; un `workflow_run` originado por `pull_request` no puede promover una imagen.
- Para tags, exigir formato SemVer estricto, pertenencia a `main` y una CI de evento `push` exitosa para ese SHA en
  `main`; una CI parcial de pull request no basta.
- Construir y escanear la imagen antes del login/push; bloquear vulnerabilidades HIGH/CRITICAL según la política
  configurada.
- Auditar todos los workspaces y dependencias transitivas con
  `yarn npm audit --all --recursive --severity high`; el modo directo por defecto no es una barrera suficiente.
- Proteger `frontend-pre-release` y `frontend-production` con revisores y reglas independientes.
- Promover por digest/SHA y conservar la relación commit → imagen → despliegue.

## 8. Estrategia de consolidación y PR

1. Terminar las pruebas focalizadas en la rama de reparación.
2. Crear un commit único y una referencia de respaldo antes de reescribir la rama.
3. Rebasar únicamente el commit de reparación sobre la punta actual de `origin/main`.
4. Resolver conflictos preservando las correcciones ya fusionadas de CRED, registro, formularios y citas.
5. Ejecutar validaciones focalizadas y después `yarn verify` completo.
6. Revisar el diff final contra `origin/main`, incluyendo secretos, rutas, permisos y lockfile.
7. Publicar un PR en borrador con evidencia reproducible, riesgos residuales y orden de rollout.
8. Retirar el estado de borrador solo cuando se hayan resuelto los bloqueos de content/RBAC/backend/operación que
   afecten al entorno objetivo.

No se incorporarán actualizaciones de dependencias ajenas al alcance. Las actualizaciones mínimas necesarias para
cerrar hallazgos HIGH/CRITICAL del audit se aceptan solo con lockfile inmutable, pruebas del tooling y ensamblado
completo.

## 9. Matriz mínima de verificación

| Área            | Unidad/componente                                  | Integración frontend          | E2E sintético                                | Backend/content                                   |
| --------------- | -------------------------------------------------- | ----------------------------- | -------------------------------------------- | ------------------------------------------------- |
| Nacimiento/edad | límites, bisiesto, frontera de 140 años            | payload de búsqueda           | fecha exacta y edad 0/140                    | rechazo equivalente de valores inválidos          |
| Mensajes/i18n   | `/`, acrónimos y marcado inerte                    | estados vacíos y paginados    | revisión ES/EN sin entidades visibles        | no aplica                                         |
| Nacionalidad    | inferencia/no sobrescritura/error de catálogo      | UUID de concepto en payload   | DNI, CE, pasaporte y edición                 | set completo, permisos y persistencia REST/DB     |
| Citas           | estado, servicio, duración, recurrencia, conflicto | hooks de visitas/colas        | crear, editar, cancelar, check-in            | transacción, capacidad, auditoría                 |
| Identidad       | formato no destructivo, UUID no ambiguos           | registro/emergencia/promoción | documentos sintéticos y paciente desconocido | regex, unicidad, duplicados y migración histórica |
| Rutas/RBAC      | nombres únicos y guards                            | apertura directa y desde menú | roles permitidos/denegados                   | privilegios asignados y denegación REST           |
| FUA             | URL y sanitización                                 | iframe inerte                 | carga desde gateway sintético                | endpoint HTTPS, roles y logging seguro            |
| Release         | parseo YAML y condiciones                          | build/assemble/scan           | no aplica                                    | ambientes protegidos y promoción por digest       |

Comandos de cierre previstos:

```bash
yarn install --immutable
yarn validate:lint-coverage
yarn test:tooling
yarn validate:route-names
yarn validate:error-exposure --base origin/main --head HEAD
yarn typecheck:e2e
yarn npm audit --all --recursive --severity high
yarn lint:all
yarn verify
yarn build
yarn assemble
```

Las suites focalizadas de paciente, registro, emergencia, FUA, citas, rutas y styleguide deben pasar además del
comando monorepo. La evidencia exacta se incluirá en el PR.

## 10. Orden de despliegue y rollback

### Preparación

1. Respaldar contenido/datos cuando exista una migración.
2. Publicar y validar los conceptos, tipos de identificador y privilegios aprobados.
3. Configurar gateway FUA, ambientes protegidos y cuenta E2E sintética.
4. Confirmar el `VisitAttributeType` de correlación cita→consulta y las reglas de identidad en el backend objetivo.
5. Ejecutar smokes por rol sin pacientes reales.

### Promoción

1. Desplegar por digest en preproducción.
2. Validar búsqueda/registro sin guardar datos inválidos.
3. Validar una cita no recurrente y una recurrente sintéticas, incluyendo un conflicto.
4. Validar accesos permitidos y denegados por rol.
5. Validar FUA solamente si el gateway está configurado; de otro modo debe permanecer oculto/inactivo.
6. Aprobar producción con evidencia adjunta y promover el mismo digest.

### Rollback

- Reapuntar al digest frontend anterior; no reconstruir una etiqueta mutable.
- Desactivar por configuración FUA o el identificador `Otros` si su dependencia no está disponible.
- No revertir automáticamente una migración clínica: usar su procedimiento versionado, respaldo y conciliación de
  conteos.
- Preservar logs de auditoría y registrar el motivo, hora, responsable y alcance del rollback.

## Riesgos residuales que el PR no puede cerrar solo

- Atomicidad de citas, colas y reglas de capacidad/proveedor en backend; los prechecks frontend no eliminan carreras
  TOCTOU entre dos clientes.
- Catálogo completo de nacionalidades y saneamiento de valores históricos.
- Aprobación coordinada de formatos/unicidad para CE, pasaporte, DIE, CNV y `Otros`, junto con auditoría histórica.
- Asignación institucional de privilegios nuevos.
- Gateway FUA de mismo origen y contrato de respuesta.
- Rotación de la credencial histórica y revisión de auditoría.
- Configuración efectiva de GitHub environments, secretos, variables y revisores.
- Despliegue efímero por SHA/digest para que E2E pruebe el artefacto del PR; el smoke externo actual no lo demuestra.
- Smokes contra un OpenMRS desplegado con contenido, tipos de atributo y roles reales.

Cada punto requiere propietario, fecha y evidencia antes de declararlo cerrado; la ausencia de error en una prueba
unitaria del frontend no constituye aprobación clínica ni operativa.
