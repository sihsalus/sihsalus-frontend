# Estado de la configuración

[Documentación](../README.md) · [Desarrollo local](README.md)

La limpieza del PR #1082 deja consumidores activos de archivos eliminados.
Los fallos de esta tabla se verificaron en `4c70c575407b2124c2e871c2196baa2625b00301`;
la reorganización posterior de Markdown no corrige esos consumidores.

| Área                  | Estado observado                                                                                                                                 | Condición para cerrar el pendiente                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Yarn                  | Sin `.yarnrc.yml`, el linker predeterminado es PnP; los scripts y rutas de tipos todavía esperan `node_modules`. La verificación estándar falla. | Definir la configuración soportada y validar una instalación inmutable y los comandos sin ajustes temporales.                   |
| Node                  | Se eliminó `.nvmrc`; `package.json` mantiene Node 24 y `packageManager` fija Yarn 4.13.0.                                                        | Alinear las guías y el mecanismo de selección de versión; `nvm use` sin versión ya no es una instrucción válida para esta rama. |
| Imágenes              | CI sigue pidiendo targets de un `Dockerfile` eliminado; también faltan la receta de Nginx y la configuración local de Compose.                   | Completar la migración de recetas y sus consumidores; volver a construir y validar el artefacto.                                |
| Gobernanza de pruebas | `validate:test-governance` requiere `config/test-governance.json`, que está eliminado.                                                           | Acordar y validar el registro o su sustitución sin omitir controles.                                                            |
| E2E                   | El runner exige `e2e/suite-catalog.json`; al faltar, rechaza la ejecución.                                                                       | Recuperar una fuente de organización verificada y mantener los controles de cuarentena, preflight y cleanup.                    |
| Espacios              | `git diff --check` informa una línea vacía extra en `.env.template`.                                                                             | Corregir el diff antes de aceptar el conjunto de la limpieza.                                                                   |

Los ajustes locales de [desarrollo](README.md) permiten comprobaciones concretas,
pero no resuelven la configuración de CI. No se debe saltar el runner E2E,
deshabilitar controles o retirar aserciones para presentar el PR como aprobado.

## Cómo interpretar la evidencia

- El lint, el contrato de tipos Vitest, el typecheck E2E y los controles de
  permisos pasaron en el SHA indicado con el entorno registrado en el PR.
- La auditoría de dependencias al umbral HIGH/CRITICAL y CodeQL pasaron;
  estos resultados no prueban ausencia de regresiones funcionales.
- Tooling falló 23 pruebas por los archivos ausentes; las dos pruebas del
  contrato Docker de Home también fallaron.
- En CI fallaron `lint`, `quality`, `styles`, E2E `contracts` y la construcción
  de imagen. La aceptación del conjunto sigue pendiente.

Para otra revisión, registrar comandos, SHA, entorno, pruebas ejecutadas y caché
según [CONTRIBUTING](../../CONTRIBUTING.md#proportional-validation). No reutilizar
esta tabla como evidencia de un nuevo commit o un ambiente desplegado.
