> **Nota de contexto (2026-08-18):** documento rescatado del host DEV (`~/pruebas-infra/`,
> fuera de control de versiones) durante la limpieza de ambientes. La prueba se ejecutó
> contra el backend de la era reference-app (`openmrs-reference-application-3-backend:3.2.1`);
> el backend activo hoy es el build clásico del distro. Los hallazgos (generación de bundles
> FHIR, privilegios de facturación, RENIPRESS/DNI) están pendientes de revalidación contra
> el backend actual — varios son de configuración/código de módulo, no de infraestructura,
> y siguen siendo relevantes para el gate de interoperabilidad.

# Reporte de Prueba de Estrés — Backend peruHCE (OpenMRS/Tomcat)

**Fecha:** 20 de marzo 2026, 14:45–14:55 (UTC-5)
**Entorno:** Contenedor Docker `peruHCE-backend` — Tomcat 8.5.83 standalone (`/usr/local/tomcat/`)
**Imagen:** `openmrs/openmrs-reference-application-3-backend:3.2.1`
**Duración:** ~10 minutos de carga sostenida
**Volumen procesado:** ~1,800 encounters (~1,740 logs/min)

---

## 1. Estado general del servidor

El servidor **no se cayó** durante la prueba. No se detectaron:

- OutOfMemoryError
- Thread pool exhaustion
- Connection pool agotado
- Timeouts de conexión a BD

Esto indica que la infraestructura base (JVM, Tomcat, BD) aguantó la carga. Sin embargo, **la capa de lógica de negocio presentó fallos funcionales masivos** que afectan la integridad de los datos generados.

---

## 2. Hallazgos detallados

### 2.1 CRÍTICO — Bundles FHIR no se generan (1,800 fallos — 100%)

- **Componente:** `EncounterSavedListener.getBundleBuilderService()` (línea 161)
- **Error:** `Error al obtener BundleBuilderService desde Spring: org.openmrs.module.Module.getApplicationContext()`
- **Impacto:** Cada vez que se guarda un encounter, el listener intenta construir un bundle FHIR para interoperabilidad. Al no poder obtener el bean `BundleBuilderService` desde el contexto de Spring, **ningún bundle se genera**. Esto significa que los 1,800 encounters procesados durante la prueba **no produjeron datos FHIR** para envío externo (MINSA/SUSALUD/etc).
- **Reproducibilidad:** 100% — ocurre en cada encounter, no solo bajo estrés.

### 2.2 ALTO — Observaciones perdidas en bundles FHIR (3,600 fallos)

- **Componente:** `BundleBuilderService.buildObservations()` (línea 476)
- **Error:** `org.hibernate.LazyInitializationException: could not initialize proxy [org.openmrs.Concept#XXXX] - no Session`
- **Conceptos afectados:** #1444, #3204, #3283, #3286, #3288, #3289, entre otros.
- **Impacto:** Aun si el issue 2.1 se resolviera, las observaciones clínicas (signos vitales, diagnósticos, resultados de laboratorio) fallan al mapearse a FHIR porque la sesión de Hibernate ya se cerró cuando el mapper intenta resolver la relación lazy del `Concept`. Promedio de **2 observaciones perdidas por encounter**.
- **Causa raíz:** El procesamiento del bundle ocurre fuera del contexto transaccional de Hibernate. Bajo carga concurrente esto se amplifica.

### 2.3 ALTO — Alergias, medicamentos y procedimientos no se mapean (1,800 c/u)

| Componente | Línea | Error |
|---|---|---|
| `BundleBuilderService.buildAllergies` | 287 | `AllergyService puede no estar disponible` |
| `BundleBuilderService.buildMedications` | 351 | `CareSetting is required` |
| `BundleBuilderService.buildProcedures` | 416 | `CareSetting is required` |

- **Impacto:** Tres secciones completas del bundle FHIR fallan sistemáticamente. Esto no es exclusivo de estrés — los errores son de configuración/datos (falta `CareSetting` en las órdenes, `AllergyService` no inyectado).

### 2.4 MEDIO — Facturación no se genera por falta de privilegios (600 fallos)

- **Componente:** `GenerateBillFromOrderAdvice.afterReturning()` (línea 110)
- **Error:** `org.openmrs.api.APIAuthenticationException: Privileges required: App: stockmanagement.stockItems`
- **Impacto:** 1 de cada 3 encounters genera una orden que dispara el interceptor de facturación, y este falla porque el usuario/contexto de ejecución no tiene el privilegio `App: stockmanagement.stockItems`. **600 órdenes no generaron su factura correspondiente.**

### 2.5 BAJO — Datos maestros incompletos (1,800 c/u)

| Componente | Línea | Detalle |
|---|---|---|
| `DyakuOrganizationMapper.toDyakuFhir` | 66 | Locations sin código RENIPRESS — usa ID interno como fallback |
| `DyakuPractitionerMapper.mapIdentifiers` | 127 | Users sin DNI — el perfil `PractitionerPe` lo requiere |

- **Impacto:** Los bundles (si se generaran) tendrían identificadores no válidos para los estándares peruanos. RENIPRESS es obligatorio para establecimientos y DNI para profesionales.

---

## 3. Distribución temporal de logs

```
14:45 UTC-5  ▓▓▓          505 logs  (inicio de carga)
14:46        ▓▓▓▓▓▓▓▓▓  1,740 logs
14:47        ▓▓▓▓▓▓▓▓▓  1,740 logs
14:48        ▓▓▓▓▓▓▓▓▓  1,740 logs
14:49        ▓▓▓▓▓▓▓▓▓  1,740 logs
14:50        ▓▓▓▓▓▓▓▓▓  1,740 logs
14:51        ▓▓▓▓▓▓▓▓▓  1,740 logs
14:52        ▓▓▓▓▓▓▓▓▓  1,740 logs
14:53        ▓▓▓▓▓▓▓▓▓  1,740 logs
14:54        ▓▓▓▓▓▓▓▓▓  1,734 logs
14:55        ▓▓▓▓▓▓▓    1,253 logs  (fin de carga)
                        ──────────
Total:                  17,412 logs
```

---

## 4. Resumen de impacto

| Severidad | Issue | Encounters afectados | ¿Solo bajo estrés? |
|---|---|---|---|
| CRÍTICO | Bundles FHIR no se generan | 1,800/1,800 (100%) | No — siempre falla |
| ALTO | Observaciones perdidas (LazyInit) | ~1,800/1,800 | Se amplifica bajo carga |
| ALTO | Alergias/Meds/Procedimientos no se mapean | 1,800/1,800 (100%) | No — siempre falla |
| MEDIO | Facturación no generada | 600/1,800 (33%) | No — siempre falla |
| BAJO | Datos maestros incompletos (RENIPRESS/DNI) | 1,800/1,800 (100%) | No — datos faltantes |

---

## 5. Recomendaciones para desarrollo

1. **Fix `EncounterSavedListener`** — Revisar cómo se obtiene el `ApplicationContext` del módulo. Posiblemente el listener se registra antes de que el módulo termine de inicializar, o el contexto de Spring del módulo no está expuesto correctamente.

2. **Fix `LazyInitializationException`** — Asegurar que `buildObservations` se ejecute dentro de una sesión Hibernate abierta (`@Transactional`, `OpenSessionInView`, o hacer eager fetch de `Concept` en la query inicial).

3. **Configurar `CareSetting`** — Las órdenes necesitan un `CareSetting` válido para que medicamentos y procedimientos se mapeen. Verificar si se está seteando al crear la orden.

4. **Asignar privilegio `stockmanagement.stockItems`** — Al usuario de sistema o al rol que ejecuta el `OrderAdvice`.

5. **Completar datos maestros** — Cargar códigos RENIPRESS en locations y DNI en los users profesionales.

---

## 6. Notas sobre performance

- **Throughput:** ~180 encounters/minuto (~3/segundo) sostenido sin degradación
- **Sin memory leaks** detectados en el período de prueba
- **Sin thread starvation** — el ThreadPoolExecutor de Tomcat manejó la carga correctamente
- La mayoría de issues son **funcionales, no de performance** — existirían igual con 1 solo usuario
