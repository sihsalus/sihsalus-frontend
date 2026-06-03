# Plantilla de apps ESM

El template vive en:

```text
packages/templates/esm-app-template
```

No esta dentro de `packages/apps` porque `packages/apps/*` es un workspace activo. Si la plantilla viviera alli, entraria al build, test, lint y armado de importmap como si fuera una app real.

## Crear una app nueva

1. Copia la plantilla:

```sh
cp -R packages/templates/esm-app-template packages/apps/esm-mi-modulo-app
```

2. Reemplaza identidad y rutas:

| Archivo | Que cambiar |
|---|---|
| `package.json` | `name`, `description`, `browser`, `keywords` |
| `src/constants.ts` | `moduleName`, `featureName`, `appName`, `basePath` |
| `src/routes.json` | `pages[].route`, `extensions[].name`, `slot`, `component` |
| `src/index.ts` | nombres de exports si cambias componentes en `routes.json` |
| `translations/*.json` | texto visible inicial |
| `README.md` | dominio, rutas, slots y comandos propios |

3. Refresca el workspace y valida:

```sh
yarn install
yarn workspace @sihsalus/esm-mi-modulo-app typescript
yarn workspace @sihsalus/esm-mi-modulo-app test
yarn workspace @sihsalus/esm-mi-modulo-app build
```

4. Arranca solo esa app en modo desarrollo:

```sh
SIHSALUS_DEV_APPS=esm-mi-modulo-app yarn start
```

## Convenciones

- El nombre de carpeta debe ser `packages/apps/esm-<dominio>-app`.
- El package debe ser `@sihsalus/esm-<dominio>-app`.
- El bundle debe ser `dist/sihsalus-esm-<dominio>-app.js`.
- `moduleName` debe vivir en `src/constants.ts`; no lo dupliques en componentes.
- `basePath` debe incluir slash inicial, por ejemplo `/mi-modulo`.
- `routes.json` usa rutas sin slash inicial, por ejemplo `mi-modulo`.
- Todo componente declarado en `src/routes.json` debe exportarse desde `src/index.ts`.
- Los textos visibles deben pasar por `useTranslation` y vivir en `translations`.
- Las opciones modificables por ambiente deben vivir en `config-schema.ts`.

## Como leer `routes.json`

`pages` monta pantallas navegables:

```json
{
  "component": "root",
  "route": "mi-modulo",
  "online": true,
  "offline": true
}
```

`component` debe coincidir con un export de `src/index.ts`:

```ts
export const root = getSyncLifecycle(Root, options);
```

`extensions` monta piezas en slots de otras apps:

```json
{
  "component": "miModuloAppMenuLink",
  "name": "mi-modulo-app-menu-link",
  "slot": "app-menu-slot"
}
```

Usa nombres estables en kebab-case. Cambiar `name` puede romper configuraciones externas, permisos o pruebas que apunten a esa extension.

## Checklist antes de abrir PR

- `package.json` no conserva `template` en nombre, bundle ni descripcion.
- `src/constants.ts` tiene `moduleName`, `featureName`, `appName` y `basePath` reales.
- `src/routes.json` referencia exports existentes.
- `README.md` de la app explica proposito, rutas, slots, configuracion y comandos.
- `translations/en.json` y `translations/es.json` tienen los textos del flujo inicial.
- `yarn workspace @sihsalus/esm-<dominio>-app typescript` pasa.
- `yarn workspace @sihsalus/esm-<dominio>-app test` pasa.
- `yarn workspace @sihsalus/esm-<dominio>-app build` pasa.

