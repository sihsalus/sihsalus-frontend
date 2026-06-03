# SIHSALUS ESM app template

Plantilla base para crear una app nueva bajo `packages/apps/esm-*-app`.

Esta carpeta vive en `packages/templates` a proposito: no entra al glob de workspaces, no se publica y no participa en `turbo run build`. Copiala a `packages/apps` cuando quieras crear una app real.

## Crear una app desde esta plantilla

```sh
cp -R packages/templates/esm-app-template packages/apps/esm-mi-modulo-app
```

Despues reemplaza estos valores en la copia:

| Valor de plantilla | Ejemplo real | Donde aparece |
|---|---|---|
| `@sihsalus/esm-template-app` | `@sihsalus/esm-mi-modulo-app` | `package.json`, `src/constants.ts` |
| `esm-template-app` | `esm-mi-modulo-app` | `package.json`, `src/constants.ts`, `README.md` |
| `sihsalus-esm-template-app.js` | `sihsalus-esm-mi-modulo-app.js` | `package.json` |
| `template` | `mi-modulo` | `src/constants.ts`, `src/routes.json`, exports de `src/index.ts` |
| `Template app` | Nombre visible del modulo | traducciones y README |

Cuando termines, refresca dependencias y valida:

```sh
yarn install
yarn workspace @sihsalus/esm-mi-modulo-app typescript
yarn workspace @sihsalus/esm-mi-modulo-app test
yarn workspace @sihsalus/esm-mi-modulo-app build
```

Para desarrollo con hot reload:

```sh
SIHSALUS_DEV_APPS=esm-mi-modulo-app yarn start
```

## Estructura

- `package.json`: identidad del workspace, scripts comunes y dependencias minimas.
- `rspack.config.js`: usa la configuracion Rspack compartida por OpenMRS/SIHSALUS.
- `tsconfig.json`: extiende la configuracion app del monorepo.
- `vitest.config.ts`: usa aliases y setup compartidos del monorepo.
- `src/index.ts`: registra config, traducciones, root page y extension de menu.
- `src/routes.json`: declara rutas y extensiones que OpenMRS carga.
- `src/config-schema.ts`: configuracion publica del modulo.
- `src/constants.ts`: unica fuente para `moduleName`, `featureName`, `appName` y `basePath`.
- `src/root.component.tsx`: primera pantalla funcional de la app.
- `src/app-menu-link.component.tsx`: extension simple para `app-menu-slot`.
- `translations/*.json`: textos visibles.

## Reglas de implementacion

- Mantener `moduleName` centralizado en `src/constants.ts`.
- Exportar en `src/index.ts` exactamente los componentes declarados en `src/routes.json`.
- No hardcodear rutas con `/openmrs/spa`; usar `globalThis.spaBase`, `globalThis.getOpenmrsSpaBase()` o `basePath`.
- Envolver superficies montadas por OpenMRS con `AppErrorBoundary`.
- Agregar configuracion de entorno en `config-schema.ts`, no como constantes sueltas.
- Mantener traducciones en `translations` desde el inicio, aunque la app solo use `en` y `es`.
- Documentar reglas de negocio propias en el README de la app copiada.

