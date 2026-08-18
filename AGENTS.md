# AGENTS.md

Instrucciones para agentes de código que trabajan en SIH Salus Frontend. Este
archivo sigue el formato abierto [AGENTS.md](https://agents.md/) y aplica a todo
el repositorio. Una instrucción explícita del usuario prevalece. Un `AGENTS.md`
más cercano tiene precedencia para su subárbol; cualquier archivo anidado debe
repetir y no debilitar las invariantes clínicas, de privacidad y de autorización
de PR definidas aquí.

## Project overview

- Monorepo clínico OpenMRS 3 con microfrontends single-spa, TypeScript, Yarn y
  Turborepo.
- La seguridad del paciente, la privacidad, la integridad de datos y la
  continuidad operativa tienen prioridad sobre la velocidad.
- Lee `CONTRIBUTING.md` completamente antes de editar cualquier archivo; es la
  fuente normativa para alcance, evidencia, riesgo y pull requests.
- Lee también el README raíz, el README del paquete afectado y los contratos
  clínicos o técnicos aplicables.

## Setup commands

Inspecciona siempre el estado antes de cambiar archivos:

```sh
git status --short --branch
```

Cuando la tarea necesite dependencias, prepara el entorno soportado:

```sh
corepack enable
yarn install --immutable
```

- Conserva los cambios ajenos. No limpies, restaures ni formatees archivos fuera
  del alcance.
- Para documentación pura, una instalación existente es suficiente.
- Para levantar el SPA, sigue el Quick Start de `README.md`; no improvises
  backends, credenciales ni variables de entorno.

## Code style and repository contracts

- Mantén el cambio mínimo y coherente con el objetivo solicitado.
- Usa los scripts y convenciones existentes del workspace; no introduzcas una
  segunda herramienta para resolver un problema ya cubierto por el monorepo.
- Declara dependencias entre workspaces en `package.json`.
- Mantén UUIDs clínicos configurables en `config-schema`, nombres de workspace
  en constantes compartidas y textos visibles en `en.json` y `es.json`.
- No debilites guards de rutas/RBAC, manejo seguro de errores ni opciones
  TypeScript ya estrictas.
- No uses producción, PHI ni pacientes reales. No expongas secretos o
  credenciales en código, pruebas, logs, capturas o documentación.

## Testing instructions

Después de crear los commits del cambio, ejecuta como base cuando haya código:

```sh
yarn verify:changed --base origin/main --head HEAD
```

- Revisa el `package.json` afectado y ejecuta sus scripts aplicables de `lint`,
  `typescript`, `test` y `build`; valida también consumidores relevantes.
- Para cambios Markdown ejecuta `yarn prettier --check` seguido de las rutas
  modificadas y después `git diff --check`.
- Usa la matriz de `CONTRIBUTING.md` para workspaces, rutas/RBAC, errores,
  conceptos, dependencias, SPA y E2E.
- No interpretes `--passWithNoTests` como regresión funcional ni un typecheck o
  build como prueba clínica.
- Registra cada validación aplicable como `PASÓ`, `FALLÓ`, `NO EJECUTADO` o
  `BLOQUEADO`, con comando, resultado, alcance y SHA/ambiente cuando corresponda.
- E2E y pruebas clínicas usan únicamente datos sintéticos en DEV/QLTY
  coordinado; nunca producción. Si falta acceso, agota las comprobaciones
  locales y bloquea solo la validación externa.

## Pull request instructions

- Crea o cambia de rama solo cuando la solicitud autorice preparar un PR y el
  árbol esté limpio o aislado. No cambies de rama en un workspace compartido con
  cambios ajenos.
- Para un PR nuevo usa por defecto una rama separada desde `origin/main`; para un
  PR existente trabaja solo en su rama. No mezcles objetivos.
- Usa título convencional: `tipo(scope): resumen`.
- Completa `.github/pull_request_template.md` sin borrar secciones. Usa `N/A`
  con una razón concreta y declara toda validación pendiente.
- Revisa el diff completo contra la base y excluye cambios ajenos, artefactos,
  secretos o datos identificables antes de publicar.
- Publica o actualiza la rama y el PR solo cuando la solicitud lo autorice.
- Abrir un PR no autoriza a fusionarlo. Nunca hagas merge, publiques un release
  ni despliegues sin instrucción explícita del responsable del repositorio.
- Si falta una decisión o autoridad que pueda cambiar el resultado, detente y
  pide únicamente lo necesario.

## Security reporting

No publiques vulnerabilidades, secretos o datos clínicos en issues o PRs. Usa el
[reporte privado de GitHub](https://github.com/sihsalus/sihsalus-frontend/security/advisories/new)
o solicita un canal privado a `sihsalus@pucp.edu.pe` sin incluir datos sensibles.
