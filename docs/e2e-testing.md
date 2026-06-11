# E2E Testing (Playwright)

El repo tiene dos flujos Playwright contra OpenMRS: una suite raiz y suites
modulares por app. Ambos usan la misma normalizacion de URLs, asi que
`E2E_BASE_URL` puede apuntar al contexto OpenMRS o directamente al SPA:

```bash
E2E_BASE_URL=http://localhost:8080/openmrs
E2E_BASE_URL=http://localhost:8080/openmrs/spa
```

Internamente se derivan:

- SPA: `http://localhost:8080/openmrs/spa`
- API REST: `http://localhost:8080/openmrs/ws/rest/v1`
- FHIR R4: `http://localhost:8080/openmrs/ws/fhir2/R4`

Si `E2E_API_BASE_URL` esta definido, se usa como base de API y tiene prioridad
sobre la derivacion desde `E2E_BASE_URL`.

## Suite raiz

La suite raiz cubre smoke tests, accesibilidad y flujos criticos transversales.

- Config: `playwright.config.ts`
- Specs: `e2e/tests/`
- Setup de sesion: `e2e/global-setup.ts`
- Estado de sesion: `e2e/storage-state.json`
- Servidor: Playwright ejecuta `webServer.command`; por defecto es `yarn start`
  y se puede cambiar con `E2E_WEB_SERVER_COMMAND`

Comando:

```bash
yarn test:e2e
```

Con URLs explicitas:

```bash
E2E_BASE_URL=http://localhost:8080/openmrs/spa \
E2E_API_BASE_URL=http://localhost:8080/openmrs \
  yarn test:e2e
```

Para specs publicos o pre-login se puede omitir el setup autenticado:

```bash
E2E_SKIP_AUTH=true yarn test:e2e
```

Si el server local ya esta levantado manualmente, desactiva el `webServer` de
Playwright para evitar un segundo `yarn start`:

```bash
E2E_DISABLE_WEB_SERVER=true yarn playwright test e2e/tests/smoke.spec.ts --project=desktop
```

### Registro de pacientes Peru

El spec `e2e/tests/patient-registration-peru.spec.ts` valida la superficie de
admision peruana contra el frontend actual:

- la seccion fusionada `Residencia, nacimiento y contacto`,
- captura separada de direccion de residencia, lugar de nacimiento y telefono,
- bloqueo de formatos invalidos como `e100` en telefono,
- mock actual de consulta RENIEC.

Para correr solo ese spec contra el backend configurado en `.env`:

```bash
E2E_DISABLE_WEB_SERVER=true \
  yarn playwright test e2e/tests/patient-registration-peru.spec.ts --project=desktop
```

El backend debe exponer los tipos de atributo `Lugar de nacimiento`
(`8d8718c2-c2cc-11de-8d13-0010c6dffd0f`) y `Numero de Telefono`
(`14d4f066-15f5-102d-96e4-000c29c2a5d7`), ademas de la plantilla
`layout.address.format`.

## Suites modulares

Las suites modulares viven bajo `e2e/<modulo>/` y prueban apps concretas:
`billing`, `cohort-builder`, `dispensing`, `fast-data-entry`, `form-builder`,
`laboratory`, `patient-imaging`, `stock-management` y `user-onboarding`.

Usan `packages/tooling/configs/playwright-suite.ts` como factory compartida y
cada una mantiene sus propios `specs/`, `core/global-setup.ts`, `fixtures/`,
`pages/` y `storageState.json`.

No tienen `webServer`; levanta frontend y backend antes de ejecutarlas.

Desde la raiz del repo:

```bash
E2E_BASE_URL=http://localhost:8080/openmrs/spa \
  yarn playwright test --config e2e/laboratory/playwright.config.ts
```

Desde el paquete de la app, usa `test-e2e` cuando exista:

```bash
cd packages/apps/esm-laboratory-app
E2E_BASE_URL=http://localhost:8080/openmrs yarn test-e2e
```

No hay un runner agregado para todas las suites modulares; se invoca cada config
por separado.

Nota: `e2e/dyaku` tambien tiene un `playwright.config.ts`, pero no es una suite
modular de OpenMRS. Es un check HTTP/FHIR externo contra Dyaku y no usa
`E2E_BASE_URL`.

## CI

Los tests E2E no se ejecutan en ningun workflow: requieren un backend OpenMRS
alcanzable y con datos/configuracion compatible, asi que se corren manualmente.

Lo que si corre en CI es el typecheck (`yarn typecheck:e2e` sobre
`e2e/tsconfig.json`), que cubre la suite raiz y el modulo `patient-imaging`,
ambos limpios. El resto de suites modulares cargan ~118 errores de tipo
preexistentes y todavia no estan en el typecheck. Se corrigen por modulo y se
agregan al `include` de `e2e/tsconfig.json`; pendientes: `form-builder` (53),
`billing` (35), `dispensing` (13), `laboratory` (10), `fast-data-entry` (7).
