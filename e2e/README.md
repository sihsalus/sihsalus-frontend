# Pruebas end-to-end

Playwright contra un OpenMRS desplegado. **Nunca contra producción ni con datos
reales**. Las suites `runnable` exigen datos sintéticos y cleanup verificado por
su gate. Las suites históricas permanecen `quarantined` precisamente porque su
aislamiento, cleanup o aceptación aún no están verificados y no deben ejecutarse.

## Catálogo y runner

[`suite-catalog.json`](suite-catalog.json) es la fuente única de organización.
Cada configuración Playwright y cada `*.spec.ts` deben pertenecer exactamente a
una de sus 12 suites. El contrato local falla si aparece una configuración o un
spec sin dueño, si hay solapamientos o si `typecheck`/`ci` dejan de coincidir con
la configuración real.

`runnable` significa que el runner permite iniciar la suite; no significa que
pueda ejecutarse sin las credenciales, datos sintéticos y ambiente coordinado
que exija su preflight. `quarantined` conserva el código como inventario, pero
lo rechaza de forma explícita hasta resolver la razón registrada en el catálogo.

| ID                 | Configuración                               | Specs                        | Estado       | Gate | Typecheck | CI navegador |
| ------------------ | ------------------------------------------- | ---------------------------- | ------------ | ---- | --------- | ------------ |
| `billing`          | `e2e/billing/playwright.config.ts`          | `e2e/billing/specs`          | quarantined  | no   | no        | no           |
| `clinical`         | `playwright.config.ts`                      | `e2e/tests`                  | **runnable** | sí   | sí        | sí           |
| `cohort-builder`   | `e2e/cohort-builder/playwright.config.ts`   | `e2e/cohort-builder/specs`   | quarantined  | no   | sí        | no           |
| `dispensing`       | `e2e/dispensing/playwright.config.ts`       | `e2e/dispensing/specs`       | quarantined  | no   | no        | no           |
| `dyaku`            | `e2e/dyaku/playwright.config.ts`            | `e2e/dyaku/specs`            | quarantined  | no   | sí        | no           |
| `fast-data-entry`  | `e2e/fast-data-entry/playwright.config.ts`  | `e2e/fast-data-entry/specs`  | quarantined  | no   | no        | no           |
| `form-builder`     | `e2e/form-builder/playwright.config.ts`     | `e2e/form-builder/specs`     | quarantined  | no   | no        | no           |
| `laboratory`       | `e2e/laboratory/playwright.config.ts`       | `e2e/laboratory/specs`       | **runnable** | sí   | sí        | sí           |
| `offline-laptop`   | `e2e/offline-laptop/playwright.config.ts`   | `e2e/offline-laptop/specs`   | **runnable** | sí   | sí        | no           |
| `patient-imaging`  | `e2e/patient-imaging/playwright.config.ts`  | `e2e/patient-imaging/specs`  | quarantined  | no   | sí        | no           |
| `stock-management` | `e2e/stock-management/playwright.config.ts` | `e2e/stock-management/specs` | quarantined  | no   | sí        | no           |
| `user-onboarding`  | `e2e/user-onboarding/playwright.config.ts`  | `e2e/user-onboarding/specs`  | quarantined  | no   | sí        | no           |

Los scripts de verificación en `e2e/scripts/` y las capturas en
`e2e/screenshots/` no son suites Playwright y no pertenecen al catálogo.

```sh
# Suite clínica principal (compatible con el comando histórico)
yarn test:e2e

# Suites ejecutables por ID; los argumentos restantes pasan a Playwright
yarn test:e2e:suite clinical --project=desktop
yarn test:e2e:suite laboratory --headed

# Gate opt-in de navegador/laptop offline contra DEV/QLTY
yarn test:e2e:offline-laptop --project="Microsoft Edge Stable" --headed

# Contratos unitarios fail-closed del gate, sin tocar backend
yarn test:e2e:offline-laptop:unit

# Contratos locales que corren en cada PR (typecheck + preflight unitario)
yarn test:e2e:contracts

# Contrato del catálogo y del runner, sin navegador ni backend
yarn test:e2e:catalog
```

El runner usa el config asociado al ID y lanza Playwright sin shell. Rechaza
IDs desconocidos, suites en cuarentena y argumentos `-c`, `--config` o
`--config=…`; por tanto, un argumento reenviado no puede sustituir la
configuración aprobada. No existe un `test:e2e:all`: promover una suite exige
resolver su razón de cuarentena y actualizar catálogo, typecheck y CI de forma
explícita.

En CI (`.github/workflows/e2e.yml`) los contratos locales corren en cada PR. Las
suites de navegador principal y laboratorio corren **solo** en PRs con la
etiqueta `e2e` o por `workflow_dispatch`, y exigen 7 variables/secretos
(preflight que falla si falta alguna). Un gate que solo corre cuando alguien se
acuerda no protege de nada: si tocas flujos clínicos, pon la etiqueta.

El preflight exige `E2E_GATE_TARGET=DEV|QLTY`, comprueba que el backend sea el
origen HTTPS exacto del ambiente elegido y solo permite que el SPA sea ese mismo
origen o un servidor loopback. Producción y hosts parecidos quedan rechazados.
En CI el SPA siempre se ensambla desde el SHA bajo prueba y se sirve en loopback;
no se valida por accidente una versión anterior desplegada.
Antes de crear workers también comprueba que ambos pacientes estén activos y
marcados como sintéticos, que la ubicación y el proveedor clínico estén activos,
y que `E2E_PATIENT_UUID` tenga exactamente una visita preparada activa. El
preflight no imprime el cuerpo del paciente en los logs.

## Cobertura activa

| Flujo                     | Evidencia E2E obligatoria                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Acceso                    | Login interactivo, sesión autenticada, shell, importmap, rutas y navegación                 |
| Consulta Externa          | Ocho pestañas, antecedentes antes de anamnesis, historiales, resultados y consultas previas |
| Diagnóstico / plan        | Búsqueda de K71.0, retiro y reemplazo del principal e indicaciones no farmacológicas        |
| Catálogos de órdenes      | Presentación ordenable de ácido ursodesoxicólico y agregado acumulativo de TGP + TGO        |
| Contratos del ambiente    | Pacientes sintéticos, visita activa, proveedor, privilegios, SIS, CIE-10 y medicamento      |
| Laboratorio               | Visualización de solicitud, recojo, registro de resultado, finalización y rechazo           |
| Otros módulos principales | Admisión, citas, registro Perú, interconsultas, odontograma y accesibilidad básica          |

Todavía no son gates E2E: interoperabilidad FUA/HIS con MINSA, NetLab, una
consulta ambulatoria completa persistida y recargada, PDFs revisados visualmente,
ni la matriz negativa de roles de solo lectura. Esos casos necesitan servicios
externos o fixtures aislados adicionales; no deben simularse como si validaran
una integración real.

## Gate de laptops offline

`e2e/offline-laptop` es una suite modular separada y deliberadamente no forma
parte de `yarn test:e2e`: crea y anula datos sintéticos y requiere un DEV o QLTY
coordinado, metadatos aprobados y Chrome/Edge instalados. Al invocarla, el
preflight falla si falta configuración, si el target y el origen no coinciden
exactamente con la allowlist HTTPS de DEV/QLTY o si el SHA desplegado no
coincide; los checks de service worker, cola, sincronización y unicidad backend
tampoco tienen reintentos ni ramas que conviertan el fallo en éxito. Solo cubre
el chart cacheado de un paciente existente y una visita offline cerrada; no
cubre registro offline, formularios, signos vitales ni órdenes. La preparación
por equipo y los criterios de evidencia están en el
[runbook de aceptación offline](../docs/runbooks/offline-laptop-acceptance.md).

## Cobertura de typecheck

`e2e/tsconfig.json` incluye la suite principal, `utils/` y las suites modulares
marcadas con `typecheck: true` en el catálogo. El contrato verifica ambas
fuentes. Están **fuera** las que aún acumulan errores de tipos:

| Suite excluida    | Errores | Naturaleza                                                                                                                                                                                                                             |
| ----------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `form-builder`    | 53      | `string \| undefined` de variables de entorno, objetos posiblemente indefinidos                                                                                                                                                        |
| `billing`         | 35      | igual que arriba                                                                                                                                                                                                                       |
| `dispensing`      | 13      | importa `Order`/`Visit`/`OpenmrsResource` desde `@openmrs/esm-framework`, que no los reexporta; tampoco están en el entry point público de `esm-emr-api`/`esm-api`. Requiere definir los tipos localmente, como hace `patient-imaging` |
| `fast-data-entry` | 7       | igual                                                                                                                                                                                                                                  |
| `screenshots`     | 4       | igual                                                                                                                                                                                                                                  |

Medido con `tsc` sobre todo `e2e/**`. Al arreglar una suite, hay que agregarla al
`include` de `e2e/tsconfig.json` y cambiar su bandera `typecheck` en el catálogo;
el contrato impide que ambas fuentes diverjan en silencio.

## Trampas verificadas en este repositorio

- **El service worker evade `page.route()`.** El SPA sirve sus peticiones por el
  service worker, así que la interceptación de Playwright no se aplica y la
  petición llega al servidor de verdad. Si un spec mockea red, necesita
  `test.use({ serviceWorkers: 'block' })` (ver `odontogram-save.spec.ts`). Sin
  eso, el test pasa "verde" mientras crea datos reales en el ambiente.
- **Las rutas del SPA son relativas al `baseURL`.** `page.goto('patient/…')`, no
  `page.goto('/patient/…')`: la barra inicial descarta `/openmrs/spa` y da 404.
- **Los selectores amplios pescan el chrome de la aplicación.** El navbar tiene
  "Agregar paciente" y el banner del paciente "Registrar signos vitales"; un
  `getByRole('button', { name: /Agregar|Registrar/i })` sin ancla encuentra esos
  antes que el del widget. Anclar con `getByRole('main')` o con el contenedor.
- **La UI evoluciona más rápido que los specs.** Antes de dar por bueno un
  fallo, comparar contra `routes.registry.json` del ambiente desplegado: la ruta
  del odontograma pasó de `Odontograma` a `atencion-odontologica` y el spec
  quedó fósil por meses.

## Datos de prueba

Los specs que necesitan un paciente lo reciben por `E2E_PATIENT_UUID`
(`E2E_APPOINTMENTS_PATIENT_UUID` para citas) y **fallan al cargar el módulo** si
falta. Ambos deben identificar pacientes reservados cuyo nombre o identificador
contenga el token independiente `E2E` o `SYNTHETIC`; el primero debe tener una
sola visita activa. Es deliberado: mejor un error claro que una corrida que no
prueba nada o que toque por accidente una historia no sintética.

Al crear datos desde un script, anularlos al terminar. Ojo: `DELETE
/ws/rest/v1/patient/{uuid}` responde **200 sin anular nada** si no se pasa
`?reason=`; con `reason` responde 204 y sí anula.
