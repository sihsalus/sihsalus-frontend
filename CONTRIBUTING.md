# Contribuir a SIH Salus Frontend

Gracias por contribuir. Este repositorio contiene software clínico: la seguridad
del paciente, la privacidad, la integridad de los datos y la continuidad
operativa tienen prioridad sobre la velocidad de entrega.

Estas reglas se aplican a personas y agentes automatizados. Antes de participar,
lee también el [Código de Conducta](CODE_OF_CONDUCT.md), el [README](README.md) y
el README del paquete que modificarás.

## Reglas no negociables

- Nunca uses producción, pacientes reales ni PHI para desarrollar, probar o
  documentar un cambio. No versionees ni expongas credenciales, tokens, logs o
  capturas que contengan información sensible o identificable.
- Las pruebas clínicas y E2E usan cuentas autorizadas mediante secretos o
  variables de entorno y datos sintéticos en un ambiente coordinado. Deben
  limpiar o anular los datos que creen.
- No afirmes que algo pasó si no ejecutaste esa validación sobre el diff o SHA
  reportado. Usa `NO EJECUTADO` o `BLOQUEADO` y explica por qué.
- Un typecheck, build o test unitario no demuestra por sí solo que un flujo
  clínico funciona contra el backend y content desplegados.
- Mantén cada PR enfocado en un solo resultado. No mezcles una corrección con
  refactors, upgrades o limpieza no necesarios.
- Conserva los cambios ajenos del árbol de trabajo. No restaures, borres,
  formatees masivamente ni incluyas archivos fuera del alcance.
- Abrir o actualizar un PR no autoriza a fusionarlo. Los agentes nunca deben
  hacer merge sin una instrucción explícita del responsable del repositorio.
- Tags, releases, promociones y despliegues requieren autorización explícita y
  siguen el [runbook de go-live](docs/runbooks/frontend-go-live.md).
- Fusionar a `main` afecta el release: un CI exitoso puede publicar la imagen y
  señalizar su despliegue a DEV/QLTY. Antes del merge, un mantenedor debe
  confirmar checks verdes, conversaciones resueltas, revisión de dominio y,
  cuando aplique, aprobación clínica o de seguridad.

Si encuentras una vulnerabilidad, un secreto o datos clínicos expuestos, no
publiques detalles explotables ni datos sensibles en un issue o PR público.
Usa el [reporte privado de vulnerabilidades de GitHub](https://github.com/sihsalus/sihsalus-frontend/security/advisories/new).
Si no puedes acceder, escribe a `sihsalus@pucp.edu.pe` sin incluir datos
sensibles y solicita un canal privado.

## Preparar un cambio

### 1. Comprueba el contexto

Antes de editar:

```sh
git status --short --branch
git fetch origin
```

- Si el trabajo pertenece a un PR existente, usa únicamente su rama.
- Para un PR nuevo, confirma primero que el árbol esté limpio o que trabajas en
  un entorno aislado autorizado. Parte de `origin/main` —salvo que el mantenedor
  indique otra base— en una rama corta y descriptiva. Usa normalmente los
  prefijos `feat/`, `fix/`, `chore/`, `docs/`, `test/` o `refactor/`:

```sh
git switch -c fix/area-descripcion origin/main
```

- No reutilices una rama que contenga cambios de otro objetivo.
- No cambies de rama en un workspace compartido con cambios ajenos. Usa un
  worktree aislado si está autorizado o detente y pide coordinación.
- Revisa issues y PRs abiertos para no duplicar trabajo.
- Identifica los paquetes afectados y sus consumidores antes de cambiar un
  contrato compartido.

### 2. Define alcance y riesgo

Antes de implementar, debes poder responder:

- ¿Qué problema observable resuelve y qué queda fuera?
- ¿Qué paquetes, rutas, workspaces, slots o flujos modifica?
- ¿Puede alterar visitas, encounters, observaciones, órdenes, citas, colas,
  identidad, seguros, permisos, auditoría u operación offline?
- ¿Depende de endpoints, FHIR, OMODs, conceptos, formularios, UUIDs, roles o
  content específico?
- ¿Requiere migración, coordinación de despliegue, feature flag o rollback?

Un cambio clínico o transversal sin respuestas verificables debe comenzar como
investigación o PR en borrador, no como una afirmación de solución completa.

## Contratos del repositorio

Respeta los [contratos que no deben romperse](README.md#contratos-que-no-deben-romperse)
y, cuando apliquen, estas reglas:

- Los conceptos, formularios, encounter types, visit types, identifiers, care
  settings y demás UUIDs clínicos configurables pertenecen a `config-schema`;
  no deben quedar escondidos en componentes.
- Toda dependencia entre workspaces debe declararse en `package.json`. El
  análisis incremental depende del grafo de manifests.
- Los nombres de workspaces, modales, rutas y extension slots usan constantes
  compartidas cuando exista una fuente canónica.
- Un launcher de workspace debe respetar la versión, props y contrato del
  workspace registrado. Evita ampliar compatibilidad v1/v2 con tipos laxos.
- Las entradas clínicas y administrativas deben fallar cerradas en frontend.
  La autorización del backend sigue siendo la fuente definitiva.
- No muestres objetos de error, endpoints, trazas ni mensajes técnicos del
  backend a usuarios. Conserva detalle técnico solo en logging seguro.
- Los textos visibles deben usar i18n y mantener `en.json` y `es.json`; una key
  cruda en pantalla es un defecto.
- No asumas que un recurso FHIR u OMOD funciona solo porque el endpoint existe.
  Documenta dependencia, versión, fallback y comportamiento cuando falta.
- No guardes datos clínicos sin visita o encounter cuando el flujo los exige.
- Si cambias un fork o paquete local `@openmrs`, identifica la divergencia con
  upstream, consumidores afectados y pruebas de contrato necesarias.
- Un workspace que ya use TypeScript estricto no puede desactivar `strict`,
  `noImplicitAny` ni `strictNullChecks` localmente.

Actualiza el README del paquete cuando cambien límites funcionales, contratos,
backend/content requerido, permisos, fallbacks o validación mínima.

## Desarrollo local

El entorno soportado usa Node 24 y Yarn 4.13.0:

```sh
corepack enable
yarn install --immutable
```

Consulta el [Quick Start](README.md#quick-start) para construir y servir el SPA.
No versionees `.env`, credenciales ni configuración privada. Los certificados
autofirmados solo se aceptan mediante configuración explícita en ambientes
controlados.

## Validación proporcional al cambio

No todos los PR necesitan todos los comandos, pero cada PR debe explicar qué
ejecutó y qué no. Después de crear los commits del PR, la base recomendada para
cambios de código es:

```sh
yarn verify:changed --base origin/main --head HEAD
```

Añade las comprobaciones que correspondan:

| Alcance                                             | Validación esperada                                                                                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Un workspace                                        | Los scripts disponibles y aplicables de su `package.json`; normalmente `lint`, `typescript`, `test` y, si cambia runtime o empaquetado, `build`. Valida también consumidores relevantes.                                                   |
| Configuración raíz, tooling o contratos compartidos | `yarn verify`, `yarn lint:all`, `yarn test:tooling`, `yarn typecheck:e2e`                                                                                                                                                                  |
| Workspaces, rutas o permisos                        | `yarn validate:workspaces`, `yarn validate:critical-route-privileges` y, si cambia navegación, `yarn validate:react-router`                                                                                                                |
| Manejo de errores                                   | `yarn validate:error-exposure --base origin/main --head HEAD` y una regresión del estado de error visible                                                                                                                                  |
| Conceptos o defaults de content                     | `yarn validate:concepts` solo contra DEV/QLTY autorizado. El comando cubre defaults extraíbles, no todo el content; sin ambiente o credenciales, registra `BLOQUEADO`                                                                      |
| Dependencias o lockfile                             | `yarn install --immutable`, `yarn security:audit` y las pruebas de tooling aplicables                                                                                                                                                      |
| Rspack, app-shell, import map o artefacto SPA       | `yarn build` y `yarn assemble`                                                                                                                                                                                                             |
| Documentación o plantillas Markdown                 | `yarn prettier --check <archivos>` y `git diff --check`                                                                                                                                                                                    |
| E2E                                                 | Confirma que la suite tocada esté incluida en `e2e/tsconfig.json` antes de interpretar `yarn typecheck:e2e`; si está excluida, usa su config o un probe específico y declara la exclusión. Ejecuta la suite aplicable con datos sintéticos |

Para un workspace, consulta primero los scripts de su `package.json` y ejecuta
solo los que existan y correspondan:

```sh
PACKAGE_NAME=@sihsalus/esm-ejemplo-app
yarn workspace "$PACKAGE_NAME" lint
yarn workspace "$PACKAGE_NAME" typescript
yarn workspace "$PACKAGE_NAME" test
yarn workspace "$PACKAGE_NAME" build
```

`yarn validate:concepts` requiere `SIHSALUS_BACKEND_URL` y credenciales de
prueba proporcionadas mediante el entorno. Úsalo únicamente contra DEV/QLTY
coordinado, nunca contra producción.

`yarn test` puede usar `--passWithNoTests`; una salida exitosa sin pruebas
descubiertas no cuenta como regresión funcional. Informa el número de pruebas o
casos realmente ejecutados.

Los cambios de alto riesgo —patient chart, identidad, workspaces, guardado,
órdenes, colas, vacunación, offline y permisos— requieren smoke manual o
Playwright contra un ambiente no productivo coordinado. El workflow E2E se
activa con la etiqueta `e2e` o manualmente; consulta [e2e/README.md](e2e/README.md).

Para cada validación registra:

- comando o caso exacto;
- estado: `PASÓ`, `FALLÓ`, `NO EJECUTADO` o `BLOQUEADO`;
- resultado y conteo cuando exista;
- alcance, ambiente y SHA si no fue estrictamente local;
- warnings, flakiness y fallos preexistentes relevantes. Para declarar un fallo
  como preexistente, reprodúcelo en `origin/main` o enlaza evidencia previa; si
  no puedes comprobarlo, escribe `no verificado como preexistente`.

## Tests y regresiones

- Una corrección debe incluir una prueba que falle por el defecto original
  siempre que sea técnicamente viable.
- Prueba el comportamiento y los límites del contrato, no únicamente snapshots
  o detalles internos.
- Para permisos, incluye caminos permitidos y denegados.
- Para red, backend u offline, cubre los estados de carga, vacío, error,
  reconexión y sesión expirada que el cambio pueda afectar.
- Para cambios clínicos manuales, registra rol, datos sintéticos, resultado y
  limpieza. No adjuntes PHI a la evidencia.
- Si una regresión automatizada no es viable, explica concretamente la razón y
  la validación alternativa; no escribas solo “no aplica”.

## Commits y título del PR

Usa commits pequeños y títulos con formato convencional:

```text
tipo(scope): resumen imperativo y específico
```

Tipos habituales: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `build` y
`ci`. Ejemplos:

```text
fix(registration): preserva ubicación de identificadores requeridos
test(e2e): cubre guardado de odontograma sin service worker
docs(contributing): define el contrato para pull requests
```

Usa `Closes #123` solo cuando el PR resuelva completamente el issue. Para
trabajo parcial, enlaza el issue sin cerrarlo automáticamente.

## Preparar el pull request

GitHub cargará [la plantilla](.github/pull_request_template.md). Conserva todas
sus secciones y completa cada línea; si algo no aplica, escribe `N/A` y la
razón. El cuerpo debe permitir que otra persona revise el cambio sin reconstruir
la investigación desde cero.

Antes de publicar o actualizar el PR:

1. Revisa `git status`, los commits y el diff completo contra `origin/main`.
2. Confirma que no hay cambios ajenos, secretos, datos reales ni artefactos
   generados no requeridos.
3. Explica resultado, causa, alcance incluido y deuda deliberadamente diferida.
4. Completa la matriz de impacto sin dejar apartados ambiguos.
5. Registra todas las validaciones aplicables. Usa `PASÓ` únicamente para las
   ejecutadas sobre el diff o SHA actual.
6. Añade capturas solo cuando aporten valor y estén libres de datos sensibles.
7. Marca el PR como draft si depende de decisiones, accesos, backend/content o
   validación clínica pendientes.
8. Solicita la etiqueta `e2e` y coordina QLTY cuando el riesgo lo requiera.
9. No hagas merge: deja el PR listo para revisión y decisión del mantenedor.

Si usas GitHub CLI, prepara primero un archivo con la plantilla completa y
publícalo explícitamente:

```sh
PR_BRANCH=docs/descripcion
PR_BODY_FILE=/tmp/sihsalus-pr-body.md
gh pr create \
  --base main \
  --head "$PR_BRANCH" \
  --title "tipo(scope): resumen" \
  --body-file "$PR_BODY_FILE"
```

Completa primero `PR_BRANCH` y `PR_BODY_FILE` con los valores reales. Sustituye
`main` solo cuando el mantenedor haya indicado otra rama base.

CI ejecuta los scripts y controles declarados, pero algunos tests permiten
`--passWithNoTests` y E2E solo corre con etiqueta o ejecución manual. CI no
sustituye una validación clínica, de backend/content o por roles. Un check verde
es evidencia técnica, no autorización de despliegue.
