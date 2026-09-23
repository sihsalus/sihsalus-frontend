# Desarrollo local

[Documentación](../README.md) · [Inicio](../../README.md)

Usa esta guía para preparar una copia local y servir el SPA. Los requisitos
de autorización, datos sintéticos y validación están en
[CONTRIBUTING](../../CONTRIBUTING.md).

## Configuración soportada

El repositorio configura Yarn con `nodeLinker: node-modules` y fija Node 24 en
`.nvmrc`. Los comandos siguientes usan esa configuración sin overrides del
linker ni del modo de entorno de Turbo. Consulta la
[referencia de configuración](tooling-status.md) para conocer sus consumidores.

## Prerequisites

- **Node.js** 24 LTS
- **Yarn** 4.13.0 (via Corepack: `corepack enable && corepack prepare yarn@4.13.0 --activate`)
- **Docker** (for containerized deployment)

## Preparación y arranque

```bash
# 1. Clonar e instalar
git clone https://github.com/sihsalus/sihsalus-frontend.git
cd sihsalus-frontend
nvm use                  # opcional si usas nvm; .nvmrc selecciona Node 24
node --version           # comprobar Node 24
corepack enable          # usa packageManager de package.json
yarn install --immutable

# 2. Configurar entorno (recomendado)
cp .env.template .env    # editar si se necesita apuntar a otro backend

# 3. Construir el SPA inicial y levantar el dev server
yarn package:spa
SIHSALUS_DEV_APPS=esm-login-app,esm-home-app yarn start
# → http://localhost:8080/openmrs/spa/

# Para usar un puerto distinto:
yarn start --port 3000
# → http://localhost:3000/openmrs/spa/
```

`yarn start` necesita primero un SPA válido en `dist/spa`; `yarn package:spa` compila las apps, ensambla ese artefacto y lo valida. El dev server hace proxy de las peticiones de API al backend definido en `SIHSALUS_BACKEND_URL` (ver [.env.template](../../.env.template)). Si no se define, usa `http://gidis-hsc-dev.inf.pucp.edu.pe` y lo advierte al arrancar.

La normalización del backend y el heartbeat se describen en la
[referencia de configuración](configuration.md#backend-y-proxy-local).

## Development

```bash
yarn install                                # Instalar dependencias
yarn package:spa                            # Primera ejecución: compilar, ensamblar y validar dist/spa
yarn start                                  # Dev server → proxy a SIHSALUS_BACKEND_URL
SIHSALUS_BACKEND_URL=http://... yarn start  # Apuntar a otro backend en esta sesión
```

Después del ensamble inicial, `yarn start` recompila con hot reload las apps de `SIHSALUS_DEV_APPS`. Vuelve a ejecutar `yarn assemble` cuando cambien rutas, el import map o la configuración ensamblada; usa `yarn package:spa` cuando también necesites reconstruir todas las apps.

## Qué comando usar (`start` vs `serve` vs `serve:prod`)

- `yarn start` (**recomendado para desarrollo diario**) usa [packages/tooling/scripts/start-dev.js](../../packages/tooling/scripts/start-dev.js), que exige un `dist/spa` ensamblado, lanza `openmrs develop` con `--importmap` y `--routes`, y sirve los demás assets/chunks desde ese artefacto mediante proxy.
- `yarn serve` ejecuta `openmrs start` directamente y no compila antes. Descubre los módulos que ya existan en `packages/apps/*/dist`, genera import map/rutas en memoria y usa `https://dev3.openmrs.org/` como backend salvo que se pase `--backend` (ver [packages/tooling/openmrs/src/commands/start.ts](../../packages/tooling/openmrs/src/commands/start.ts)).
- `yarn serve:prod` ejecuta `build:apps`, ensambla `dist/spa` y después lanza `openmrs start`. No ejecuta el build repo-wide de todas las librerías y herramientas por separado.

Resumen práctico:

- Para desarrollo local con hot-reload/control de módulos: `yarn start`.
- Para validar `openmrs start` con artefactos ya compilados: `yarn serve --backend http://...`.
- Para compilar las apps, ensamblar y validar antes de servir: `yarn serve:prod --backend http://...`.

## Building

```bash
yarn build                                  # Build all packages
yarn build:apps                             # Build only app packages
yarn assemble                               # Assemble import map
yarn package:spa                            # Build apps + assemble + validate dist/spa
yarn turbo run build --filter=<package>     # Build single package
```

El ensamble agrega al precache del service worker cada hoja de estilos local
enlazada por `index.html`, incluso si supera el límite de tamaño predeterminado
de Workbox. `validate-spa-artifact` verifica ese contrato para que una
reconexión no pueda recuperar el shell sin sus estilos globales.

El service worker conserva el ciclo de vida y las rutas de OpenMRS. La entrada local
`packages/tooling/app-shell/service-worker.ts` agrega una ruta Workbox `NetworkOnly`
para lecturas GET que solicitan conjuntamente `cache: 'no-store'` y
`x-omrs-offline-caching-strategy: network-only-or-cache-only`. Esa combinación exige
red fresca; las demás estrategias offline mantienen su comportamiento. El cambio
requiere activar el worker actualizado y cerrar las pestañas de la versión anterior.

## Cleaning

```bash
yarn clean                                  # Remove generated monorepo artifacts
yarn clean --dry-run                        # Preview what would be removed
```

`yarn clean` is a repo-wide clean for generated artifacts only. It removes workspace outputs such as `dist/`, `coverage/`, `.turbo/`, `storybook-static/`, Playwright reports, and TypeScript build info files without touching `node_modules/` or source directories.

Use `yarn clean --dry-run` first when you want to inspect what will be deleted.

## Concurrency

This monorepo has 90 workspace packages. Avoid high concurrency on resource-constrained machines:

```bash
yarn turbo run build --concurrency=4
yarn turbo run test --filter=@sihsalus/esm-login-app   # Single package
```
