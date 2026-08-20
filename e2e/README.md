# Pruebas end-to-end

Playwright contra un OpenMRS desplegado. **Nunca contra producción ni con datos
reales**: los specs crean y anulan pacientes sintéticos.

## Qué corre y qué no

Hay dos conjuntos con contratos distintos. Confundirlos es la causa de que
existieran specs escritos contra componentes borrados meses atrás.

| Conjunto                | Ubicación                      | ¿Corre con `yarn test:e2e`?                          | ¿Typecheck en CI?       |
| ----------------------- | ------------------------------ | ---------------------------------------------------- | ----------------------- |
| Suite principal         | `e2e/tests/*.spec.ts`          | **Sí** (`testDir` de `playwright.config.ts`)         | Sí                      |
| Suites modulares        | `e2e/<módulo>/specs/*.spec.ts` | No — cada una tiene su propio `playwright.config.ts` | Solo las listadas abajo |
| Scripts de verificación | `e2e/scripts/*.mjs`            | No — se ejecutan a mano con `node`                   | No                      |
| Capturas                | `e2e/screenshots/`             | No                                                   | No                      |

```sh
# Suite principal (3 proyectos: desktop, tablet, mobile)
yarn test:e2e

# Una suite modular
yarn playwright test -c e2e/<módulo>/playwright.config.ts --headed

# Gate opt-in de navegador/laptop offline contra DEV/QLTY
yarn test:e2e:offline-laptop --project="Microsoft Edge Stable" --headed

# Contrato fail-closed del gate, sin tocar backend
yarn test:e2e:offline-laptop:config

# Typecheck de lo que está bajo contrato
yarn typecheck:e2e
```

En CI (`.github/workflows/e2e.yml`) la suite principal corre **solo** en PRs con
la etiqueta `e2e` o por `workflow_dispatch`, y exige 7 variables/secretos
(preflight que falla si falta alguna). Un gate que solo corre cuando alguien se
acuerda no protege de nada: si tocas flujos clínicos, pon la etiqueta.

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
que compilan limpio. Están **fuera** las que aún acumulan errores de tipos:

| Suite excluida    | Errores | Naturaleza                                                                                                                                                                                                                             |
| ----------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `form-builder`    | 53      | `string \| undefined` de variables de entorno, objetos posiblemente indefinidos                                                                                                                                                        |
| `billing`         | 35      | igual que arriba                                                                                                                                                                                                                       |
| `dispensing`      | 13      | importa `Order`/`Visit`/`OpenmrsResource` desde `@openmrs/esm-framework`, que no los reexporta; tampoco están en el entry point público de `esm-emr-api`/`esm-api`. Requiere definir los tipos localmente, como hace `patient-imaging` |
| `laboratory`      | 10      | env vars y campos opcionales                                                                                                                                                                                                           |
| `fast-data-entry` | 7       | igual                                                                                                                                                                                                                                  |
| `screenshots`     | 4       | igual                                                                                                                                                                                                                                  |

Medido con `tsc` sobre todo `e2e/**`. Al arreglar una suite, **agrégala al
`include`** de `e2e/tsconfig.json`: es lo único que impide que vuelva a
degradarse en silencio.

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
falta — es deliberado: mejor un error claro que una corrida que no prueba nada.

Al crear datos desde un script, anularlos al terminar. Ojo: `DELETE
/ws/rest/v1/patient/{uuid}` responde **200 sin anular nada** si no se pasa
`?reason=`; con `reason` responde 204 y sí anula.
