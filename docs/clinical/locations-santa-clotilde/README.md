# Modelo de ubicaciones, UPS y UPSS — Hospital II-1 Santa Clotilde

**Estado:** propuesta de arquitectura y plan de trabajo; pendiente de información y validación institucional.

**Última revisión:** 2026-07-23.

**Ámbito:** Hospital II-1 Santa Clotilde, distrito Napo, provincia Maynas, departamento Loreto.

**Fuera de alcance:** cualquier otra sede o establecimiento.

## 1. Propósito

Este documento define el plan para separar correctamente:

- la identidad de la IPRESS;
- los lugares físicos donde ocurre la atención;
- las Unidades Productoras de Servicios (UPS);
- las Unidades Productoras de Servicios de Salud (UPSS);
- las prestaciones, citas, colas, visitas y encuentros;
- las capacidades operativas asociadas a cada lugar.

El objetivo no es solamente ordenar nombres. El modelo debe impedir combinaciones
clínicas incoherentes, conservar la interpretación del histórico y permitir que
citas, colas, hospitalización, farmacia y reportes utilicen las mismas reglas.

No se deben modificar Locations, UUID, padres, tags ni datos históricos hasta
terminar la línea base y aprobar la correspondencia con la realidad del hospital.

## 2. Línea base de la revisión

La revisión inicial se realizó sobre:

| Repositorio         | Revisión auditada                                        |
| ------------------- | -------------------------------------------------------- |
| `sihsalus-frontend` | `origin/main` `b47116509aab06ba3566776525bdc373ef37a16c` |
| `sihsalus-content`  | `main` `b0e23dc1a90750a94bcbc9887f589ae68cc906ee`        |
| `sihsalus-distro`   | `main` `a8303fe9bfbade05a93e54ba533b76312c8db30c`        |

Esta línea base describe los repositorios. Antes de una migración debe
contrastarse con los metadatos y módulos realmente instalados en PowerEdge y
en el ambiente de calidad.

## 3. Fundamento técnico y normativo

### 3.1 MINSA

La NTS N.° 021-MINSA/DGSP-V.03 define:

- **UPS:** unidad básica funcional del establecimiento, constituida por
  recursos humanos y tecnológicos organizados para desarrollar funciones
  homogéneas y producir servicios;
- **UPSS:** UPS organizada para desarrollar funciones homogéneas y producir
  servicios de salud.

Fuente: [NTS N.° 021-MINSA/DGSP-V.03](https://www.minsa.gob.pe/Recursos/OTRANS/08Proyectos/2021/PIM-SS-2021_norma-12.pdf).

La normativa de infraestructura del segundo nivel diferencia esas unidades de
sus áreas y ambientes físicos, y establece criterios de ubicación, relaciones,
características y equipamiento de dichos ambientes.

Fuente: [Infraestructura y equipamiento de establecimientos del segundo nivel de atención](https://repositorio.minsa.gob.pe/handle/MINSA/77199).

La NTS N.° 249-MINSA/DGAIN-2026 establece la cartera de servicios del sector.
Su catálogo no debe interpretarse por sí solo como prueba de que una
prestación está habilitada en el Hospital Santa Clotilde. La cartera efectiva
debe contrastarse con la información institucional vigente.

Fuentes:

- [R.M. N.° 625-2026-MINSA](https://www.gob.pe/institucion/minsa/normas-legales/8389687-625-2026-minsa).
- [Consulta oficial RENIPRESS](https://www.gob.pe/10202-obtener-informacion-de-las-instituciones-prestadoras-de-servicios-de-salud-renipress).

### 3.2 OpenMRS

OpenMRS define `Location` como un lugar físico, por ejemplo un hospital, una
clínica o una habitación. Cada Location puede tener un solo padre. Los
agrupamientos lógicos deben representarse mediante metadatos, no forzando una
segunda jerarquía dentro de `Location`.

Fuentes:

- [OpenMRS Location API](https://docs.openmrs.org/doc/org/openmrs/Location.html).
- [OpenMRS REST: Locations, tags y atributos](https://rest.openmrs.org/).

## 4. Vocabulario canónico

| Término           | Significado en SIHSALUS                                         | Representación propuesta                                    |
| ----------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| IPRESS            | Establecimiento autorizado que brinda servicios de salud        | Location física raíz con atributos institucionales          |
| Sede física       | Inmueble o emplazamiento operativo de la IPRESS                 | Location                                                    |
| Área o ambiente   | Edificio, zona, consultorio, sala, tópico, ventanilla o almacén | Location descendiente                                       |
| Punto de atención | Ambiente físico donde se atiende, espera, dispensa o registra   | Location descendiente con tags operativos                   |
| UPS               | Unidad funcional que agrupa recursos y funciones homogéneas     | Clasificación funcional codificada                          |
| UPSS              | UPS que produce servicios de salud                              | Clasificación funcional codificada                          |
| Prestación        | Servicio de salud concreto ofrecido al paciente                 | Concepto/AppointmentService y contrato de enrutamiento      |
| VisitType         | Tipo del episodio de atención                                   | VisitType de OpenMRS                                        |
| Visit             | Episodio de interacción del paciente con el sistema de salud    | Visit de OpenMRS                                            |
| Encounter         | Registro clínico granular ocurrido dentro de una Visit          | Encounter de OpenMRS                                        |
| LocationTag       | Capacidad operativa del lugar                                   | Login, Visit, Queue, Appointment, Admission, Transfer, etc. |

Una UPSS puede coincidir con un área física concreta, pero son identidades
distintas. En ese caso se modelará el área física como Location y su
afiliación funcional como un código o relación explícita.

### 4.1 Convención transitoria de interfaz

Mientras las unidades funcionales heredadas continúen almacenadas como
`Location`, el frontend aplicará esta convención de presentación:

| Contexto visible                                                                      | Término de interfaz |
| ------------------------------------------------------------------------------------- | ------------------- |
| Unidad funcional que enruta una cita, cola, visita o acción clínica                   | UPSS                |
| Establecimiento, sede, domicilio, consultorio, sala, cama, almacén o punto físico     | Ubicación/ambiente  |
| Nombre de recurso, tipo, UUID, propiedad o contrato técnico de OpenMRS/FHIR            | `Location`          |

Esta convención corrige el lenguaje operativo, pero no reclasifica los datos ni
convierte una Location física en UPSS. El UUID y los contratos backend se
mantienen sin cambios hasta ejecutar la migración aprobada. Una pantalla nueva
no debe mostrar “ubicación” para un selector funcional solo porque su propiedad
técnica se llame `location`.

## 5. Principios no negociables

1. `Location` representa un lugar físico.
2. La jerarquía `parentLocation` representa contención física.
3. UPS y UPSS no se deducen del texto del nombre.
4. Los tags expresan capacidades operativas, no la historia clínica completa.
5. `VisitType` no equivale a una UPSS.
6. Los servicios se identifican por UUID o código estable, nunca por nombre.
7. No se reutiliza un UUID existente con un significado distinto.
8. No se elimina ni reclasifica historial ambiguo.
9. Una reorganización futura no puede cambiar retroactivamente la UPSS
   reportada para una atención pasada.
10. El filtrado frontend mejora la operación, pero no sustituye autorización
    backend.
11. La configuración desplegada debe ser reproducible desde repositorios.
12. No se crea una UPSS, prestación o ambiente sin evidencia institucional.

## 6. Diagnóstico del modelo actual

Dentro del alcance del Hospital Santa Clotilde, el contenido actual modela:

- una Location raíz para el hospital;
- quince Locations funcionales rotuladas como UPS o UPSS;
- seis salas físicas;
- Locations funcionales utilizadas directamente para Visits, colas y citas;
- salas de hospitalización subordinadas a una UPSS funcional.

El inventario se encuentra en:

```text
sihsalus-content/
  configuration/backend_configuration/locations/sihsalus-locations.csv
  configuration/backend_configuration/locationtags/locationtags.csv
  configuration/backend_configuration/queues/sihsalus-queues.csv
  configuration/backend_configuration/appointmentservicedefinitions/servicedefinitions.csv
  docs/contracts/hsc-care-routing.csv
```

Todavía no existe un inventario versionado de consultorios, tópicos,
ventanillas, salas de espera, toma de muestras, ambientes de imágenes,
dispensación o almacenes. Tampoco se provisionan atributos de Location para
código IPRESS, categoría, tipo físico o afiliación funcional UPS/UPSS.

### 6.1 Hallazgos prioritarios

| Prioridad | Hallazgo                                                                 | Riesgo                                                 |
| --------- | ------------------------------------------------------------------------ | ------------------------------------------------------ |
| P0        | Care logbook depende de `Visit.location` legacy para identificar la UPSS | Requiere mapping explícito antes de migrar Locations   |
| P0        | Citas valida servicio y Location por separado                            | Citas que no tienen una ruta válida de llegada         |
| P0        | Selectores cargan Locations por tag sin limitar al hospital              | Selección o consulta fuera del contexto operativo      |
| P0        | No está demostrada la autorización backend por Location                  | El filtro visual puede confundirse con seguridad       |
| P1        | Una sola jerarquía mezcla unidad funcional y espacio físico              | Reparentar rompe navegación, traslados y reportes      |
| P1        | Visitas manuales no aplican siempre la compatibilidad Location–VisitType | Episodios clínicamente incoherentes                    |
| P1        | Farmacia funcional se usa como punto físico de dispensación              | Inventario, dispensación y auditoría ambiguos          |
| P1        | Existen dos archivos de configuración frontend divergentes               | Diferencias silenciosas entre repositorio y despliegue |
| P2        | Visitas activas consultan cada Location descendiente por separado        | Carga creciente al incorporar ambientes físicos        |

### 6.2 Evidencia en frontend

- El formulario de citas carga todas las `Appointment Location`, valida que
  servicio y Location no estén vacíos y autocompleta la Location del servicio,
  pero no conserva una restricción relacional:
  [appointments-form.workspace.tsx](../../../packages/apps/esm-appointments-app/src/form/appointments-form.workspace.tsx).
- Las colas cargan globalmente las `Queue Location` y conservan selección en
  `sessionStorage` sin identidad de facility:
  [useQueueLocations.ts](../../../packages/apps/esm-service-queues-app/src/create-queue-entry/hooks/useQueueLocations.ts) y
  [store.ts](../../../packages/apps/esm-service-queues-app/src/store/store.ts).
- Las reglas de elegibilidad entre Location y VisitType se aplican
  condicionalmente al origen del formulario:
  [visit-form.workspace.tsx](../../../packages/apps/esm-patient-chart-app/src/visit/visit-form/visit-form.workspace.tsx).
- Care logbook presenta `visit.visitType.display` como “Tipo de visita” y
  `visit.location.display` como “UPSS” en columnas independientes; la segunda
  denominación es transitoria mientras la Location funcional siga siendo legacy:
  [admissions.resource.ts](../../../packages/apps/esm-care-logbook-app/src/resources/admissions.resource.ts).
- Stock busca Locations con tags `main store`, `main pharmacy` o `dispensary`,
  que no están provisionados en el contenido revisado:
  [stock-lookups.resource.ts](../../../packages/apps/esm-stock-management-app/src/stock-lookups/stock-lookups.resource.ts).

## 7. Modelo objetivo

La jerarquía definitiva se completará únicamente con la información física
entregada por el hospital. La estructura conceptual será:

```text
Hospital Santa Clotilde                         [IPRESS / Facility]
└── área física confirmada                      [Location]
    └── ambiente o punto operativo confirmado   [Location]
```

Ejemplo exclusivamente ilustrativo, no autorizado para provisionamiento:

```text
Ambiente físico
  ├── pertenece a: Hospital Santa Clotilde
  ├── afiliación funcional vigente: UPSS codificada
  ├── prestaciones habilitadas: códigos/UUID
  └── capacidades:
      ├── Visit Location
      ├── Queue Location
      └── Appointment Location
```

### 7.1 Metadatos institucionales propuestos

La Location raíz deberá poder expresar, con códigos y fuentes verificables:

- código IPRESS/RENIPRESS;
- nombre oficial;
- categoría vigente y fecha de vigencia;
- UBIGEO;
- departamento, provincia y distrito;
- estado operativo;
- fuente y fecha de verificación.

La categoría `II-1` será metadato institucional. No será necesario repetirla
en el nombre técnico de cada ambiente.

### 7.2 Metadatos físicos propuestos

Cada ambiente deberá poder expresar:

- tipo físico codificado;
- Location física padre;
- estado activo/retirado;
- carácter intramural o extramural;
- accesibilidad o restricciones operativas relevantes;
- capacidades mediante LocationTags.

### 7.3 Afiliación funcional

La relación física–funcional deberá incluir:

- código UPS o UPSS;
- fuente del código;
- fecha de inicio;
- fecha de término, cuando corresponda;
- estado;
- cardinalidad.

Si un ambiente puede atender más de una unidad funcional o cambiar de
afiliación con el tiempo, un único `LocationAttribute` no será suficiente. En
ese caso se diseñará una relación efectiva versionada.

## 8. Contrato transaccional por definir

Las siguientes reglas son el punto de partida:

| Recurso                | Regla preliminar                                                          |
| ---------------------- | ------------------------------------------------------------------------- |
| `Appointment.service`  | Prestación programada, identificada por UUID estable                      |
| `Appointment.location` | Punto físico programado o estado explícito “por asignar”                  |
| `Queue.location`       | Lugar físico donde el paciente espera o es atendido                       |
| `Queue.service`        | Servicio operativo de la cola                                             |
| `Encounter.location`   | Ambiente físico real donde ocurrió el acto clínico                        |
| UPSS reportada         | Código funcional vigente, con snapshot transaccional cuando sea necesario |

La semántica de `Visit.location` queda como una decisión de arquitectura
pendiente. Debe elegirse una sola política:

| Alternativa                       | Uso                                                             | Condición                                               |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| IPRESS/ámbito físico del episodio | Una Visit puede contener atención en varios ambientes           | Encounters y colas conservan el lugar granular          |
| Punto físico principal            | Cada servicio o traslado inicia un episodio claramente separado | El flujo garantiza que no se falsea una Visit multiarea |

La decisión deberá contrastarse con consulta externa, emergencia,
hospitalización, traslados, atención directa, telemedicina y reportes.

## 9. Estándar de validación frontend

Zod, Yup o React Hook Form no serán la fuente primaria de reglas clínicas. El
estándar será:

1. Una función pura compartida expresa la regla de dominio.
2. El esquema del formulario invoca esa función.
3. Las relaciones entre campos se validan con `superRefine` o el mecanismo
   equivalente del formulario.
4. La validación se repite inmediatamente antes del envío.
5. Las entidades se identifican por UUID/código, no por `display`.
6. El backend sigue siendo la última barrera de integridad.
7. Cada regla tiene pruebas positivas, negativas y de datos retirados.

Ejemplo conceptual:

```ts
appointmentsSchema.superRefine((values, context) => {
  if (!isServiceAllowedAtLocation(values.serviceUuid, values.locationUuid)) {
    context.addIssue({
      code: "custom",
      path: ["locationUuid"],
      message: "La prestación no está habilitada en esta ubicación",
    });
  }
});
```

La validación no debe existir solamente dentro de un `onChange`, porque los
datos también pueden llegar por edición, valores iniciales, estado persistido
o integraciones.

## 10. Plan de trabajo

### Fase 0 — Información y línea base

**Objetivo:** congelar el estado real antes de cambiar metadatos.

Entregables:

- export de Locations, tags y atributos instalados;
- módulos backend y versiones;
- conteos de referencias por Location;
- diferencia PowerEdge/QLTY/content;
- cartera vigente y fuentes;
- plano o inventario funcional de ambientes;
- matriz legacy–objetivo;
- registro de UUID protegidos.

No se realizan escrituras en esta fase.

### Fase 1 — Integridad inmediata del frontend

#### PR F1 — Reportes

- Renombrar la dimensión actual a “Tipo de atención”.
- Mostrar la Location en una columna independiente.
- No calcular UPSS desde `VisitType`.
- Añadir pruebas para consulta ambulatoria, emergencia y hospitalización.

#### PR F2 — Alcance del hospital

- Crear un resolver común de pertenencia al Hospital Santa Clotilde.
- Restringir citas, colas, visitas, salas y stock a ese ámbito.
- Persistir selecciones junto con `facilityUuid`.
- Invalidar selección al cambiar de facility, retirar una Location o romperse
  la relación de pertenencia.
- Tratar UUID externos, huérfanos o retirados como errores cerrados.

Este alcance es operacional. La autorización debe verificarse también en el
backend.

#### PR F3 — Citas

- Seleccionar AppointmentServices por UUID.
- Restringir o bloquear la Location configurada para el servicio.
- Añadir validación cruzada servicio–Location.
- Comprobar la ruta de llegada antes de guardar.
- Cubrir creación, edición, reprogramación, cancelación y llegada.

#### PR F4 — Visits

- Aplicar elegibilidad Location–VisitType desde todos los puntos de entrada.
- Diferenciar Location de Visit y Encounter según el ADR.
- Impedir combinaciones manuales no habilitadas.
- Validar datos iniciales, edición y reanudación de workspaces.

#### PR F5 — Semántica compartida

- Crear una abstracción común para el contexto de atención:

```ts
interface CareLocationContext {
  facilityUuid: string;
  physicalLocationUuid?: string;
  functionalUnitCode?: string;
  serviceUuid?: string;
  visitTypeUuid?: string;
}
```

- Eliminar regex y decisiones basadas en nombres como “emergencia” o
  “consulta externa”.
- Centralizar resolución de descendencia, tags y capacidades.

### Fase 2 — Modelo de contenido

Esta fase se inicia después de validar la información institucional.

#### PR C1 — Metadatos

- Provisionar LocationAttributeTypes necesarios.
- Provisionar LocationTags operativos faltantes con UUID estables.
- Registrar identidad institucional y fuente.
- Añadir validadores de cardinalidad y códigos.

#### PR C2 — Jerarquía física

- Crear únicamente ambientes confirmados.
- Mantener las Locations funcionales actuales como legacy.
- No reutilizar UUID funcionales para nuevos ambientes.
- Impedir Locations físicas huérfanas.

#### PR C3 — Enrutamiento clínico

- Relacionar prestación, punto de cita, cola, VisitType y UPSS.
- Exigir una sola ruta activa por servicio cuando el flujo lo requiera.
- Mantener rutas directas explícitas para atenciones sin cola.
- Versionar cambios de afiliación funcional.

#### PR C4 — Farmacia y stock

- Separar UPSS Farmacia, ambiente físico, dispensación y almacenes.
- Provisionar `main store`, `main pharmacy` y `dispensary`.
- Configurar la relación entre lugar prescriptor y dispensador.
- Restringir el administrador para no crear Locations sin padre o clase.

### Fase 3 — Distro, configuración y seguridad

- Determinar una única fuente efectiva de `frontend.json`.
- Crear validación cruzada entre frontend, content y distro.
- Verificar en runtime si `datafilter` está instalado y activo.
- Definir autorización backend por rol y ámbito.
- Probar que ocultar una Location en frontend no sea la única protección.
- Registrar decisiones y cambios sensibles en auditoría.

### Fase 4 — Migración

Orden obligatorio:

1. Respaldar y exportar la línea base.
2. Agregar metadatos y Locations nuevas sin cambiar las existentes.
3. Desplegar frontend con lectura legacy y nueva.
4. Habilitar nuevas escrituras detrás de una bandera.
5. Mantener lectura histórica de Locations funcionales.
6. Backfill únicamente de relaciones determinísticas.
7. Reconciliar conteos y muestras clínicas.
8. Cambiar rutas activas gradualmente.
9. Retirar tags legacy cuando no tengan consumidores.
10. Mantener UUID y registros históricos en modo lectura.

No se hará:

- borrado físico;
- cambio masivo de padres sin inventario de referencias;
- reclasificación automática por nombre;
- backfill de casos ambiguos;
- reutilización de UUID.

### Fase 5 — Rendimiento y observabilidad

- Consolidar las implementaciones duplicadas de visitas activas.
- Evitar una consulta de Visits por cada ambiente físico.
- Medir cantidad de Locations, peticiones, latencia y errores.
- Monitorear fallos de enrutamiento de citas y colas.
- Alertar sobre Locations huérfanas, retiradas o sin mapping.

## 11. Matriz de pruebas

| Flujo            | Caso principal                           | Casos negativos obligatorios                            |
| ---------------- | ---------------------------------------- | ------------------------------------------------------- |
| Inicio de sesión | Seleccionar Hospital Santa Clotilde      | Location no Login, retirada o externa                   |
| Cita             | Servicio y punto físico compatibles      | Servicio sin mapping, Location distinta o retirada      |
| Llegada de cita  | Resolver ruta directa o cola exacta      | Mapping duplicado, incompleto o inexistente             |
| Cola sin cita    | Punto y servicio habilitados             | Estado persistido de otra facility, servicio incorrecto |
| Visit manual     | Location y VisitType compatibles         | Tipo no habilitado en el punto                          |
| Encounter        | Guardar ambiente físico real             | Location fuera del ámbito de la Visit                   |
| Emergencia       | Atención inmediata sin exigir cita       | Detección por nombre o UUID no configurado              |
| Hospitalización  | Admitir y transferir entre salas válidas | Sala sin Admission/Transfer o fuera del ámbito          |
| Farmacia         | Dispensar desde punto operativo          | Usar UPSS funcional como almacén implícito              |
| Reportes         | Mostrar tipo, lugar y UPSS correcta      | Derivar UPSS desde VisitType o nombre actual            |

Cobertura mínima:

- pruebas unitarias de reglas puras;
- pruebas de esquema y validación cruzada;
- pruebas de integración del contrato content–frontend;
- E2E de rutas clínicas críticas;
- reconciliación read-only contra datos reales;
- pruebas por rol;
- pruebas de rollback.

## 12. Criterios de aceptación

La normalización estará lista para cierre cuando:

- toda Location seleccionable pertenezca físicamente al Hospital Santa
  Clotilde;
- ninguna pantalla presente VisitType como UPSS;
- ninguna cita guarde servicio y Location incompatibles;
- toda cola activa tenga punto físico, servicio y política de Visit definidos;
- Visits y Encounters sigan el contrato aprobado;
- la UPSS histórica permanezca interpretable después de una reorganización;
- hospitalización y traslados funcionen con la jerarquía física;
- farmacia, dispensación y almacenes sean entidades diferenciadas;
- no existan reglas clínicas basadas en nombres;
- no existan Locations físicas huérfanas;
- la configuración instalada coincida con la versionada;
- el backend aplique los permisos definidos;
- los validadores cruzados pasen en CI;
- exista evidencia de pruebas y reconciliación en QLTY antes de producción.

## 13. Información pendiente

Cuando esté disponible, se incorporará sin asumir valores:

### Identidad institucional

- código IPRESS/RENIPRESS;
- nombre oficial;
- categoría y vigencia;
- UBIGEO y dirección;
- documento o fuente de validación.

### Cartera y organización funcional

- UPS y UPSS activas;
- prestaciones habilitadas;
- servicios suspendidos, tercerizados o en implementación;
- fechas de vigencia;
- responsable de validación.

### Ambientes físicos

Formato sugerido:

```csv
physical_key,name,parent_key,space_type,status,upss_code
```

### Enrutamiento operativo

Formato sugerido:

```csv
service_code,care_mode,appointment_point,queue_point,visit_type,encounter_point
```

### Hospitalización, farmacia y stock

- salas y uso real;
- camas activas;
- reglas de traslado;
- puntos de dispensación;
- almacenes y subalmacenes;
- relación entre prescripción, dispensación e inventario.

## 14. Artefactos que acompañarán este README

Se añadirán progresivamente:

```text
docs/clinical/locations-santa-clotilde/
├── README.md
├── ADR-visit-location.md
├── legacy-location-inventory.csv
├── physical-location-inventory.csv
├── care-routing.csv
├── migration-map.csv
├── validation-report.md
└── sources.md
```

Ninguno de estos archivos deberá contener credenciales, datos personales de
pacientes ni información clínica identificable.

## 15. Historial de decisiones

| Fecha      | Decisión                                                                                |
| ---------- | --------------------------------------------------------------------------------------- |
| 2026-07-23 | El alcance se limita al Hospital II-1 Santa Clotilde.                                   |
| 2026-07-23 | Cualquier otra sede o establecimiento queda fuera de alcance.                           |
| 2026-07-23 | No se modifican Locations ni UUID hasta recibir y validar la información institucional. |
| 2026-07-23 | La migración será aditiva, reversible y compatible con el histórico.                    |
| 2026-07-23 | Los selectores funcionales legacy se muestran como UPSS; los lugares físicos conservan “ubicación” o “ambiente”. |
| 2026-07-23 | Care logbook separa “Tipo de visita” y “UPSS” tanto en pantalla como en su exportación CSV. |
