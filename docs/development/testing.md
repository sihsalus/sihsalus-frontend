# Pruebas y calidad

[Documentación](../README.md) · [Inicio](../../README.md)

La matriz normativa por alcance está en
[CONTRIBUTING](../../CONTRIBUTING.md#proportional-validation). Prepara el entorno
según [desarrollo local](README.md) y consulta los
[contratos de configuración](tooling-status.md): una orden documentada no implica
que su validación esté aprobada en esta rama.

## Pruebas locales

```bash
yarn test                                   # Run all unit tests
yarn turbo run test --filter='@sihsalus/*' # Test SIH Salus packages only
yarn test:e2e                               # Run Playwright E2E tests
yarn test:styles                            # Check compiled CSS/SCSS in Chromium, without a backend
```

Run `yarn playwright install chromium` before the first local `yarn test:styles`.
This command builds the shared Rspack configuration and checks its CSS/SCSS rules
through Imágenes, Stock and Onboarding, plus the styleguide's CSS extraction
and the source-built app shell's Webpack rules.
It verifies default imports, scoped classes and computed styles using temporary
fixtures in an offline browser context. CI runs it for every PR and push to
`main`; it is independent of the clinical E2E suites and their credentials.

Apps using `openmrs/default-rspack-config` obtain `css-loader` from
`@openmrs/rspack-config`. Keep that dependency in the shared configuration;
the styleguide declares its own because it has a separate build configuration.
The app shell also preserves default CSS Module imports with
`modules.namedExport: false` and automatic module detection. Ordinary CSS/SCSS,
including the framework stylesheet, must remain global.
All three build configurations use `exportLocalsConvention: 'camel-case'` to
preserve original class names and camelCase aliases. Consumers such as numeric
observations must retain bracket imports like `styles['critical-value']` as
well as dot imports. The five browser variants check both forms in CSS and SCSS.

## Calidad y TypeScript

```bash
yarn lint                                   # Biome lint in all packages
yarn typecheck                              # TypeScript check all packages
yarn verify                                 # lint + typecheck + test
yarn verify:changed --base origin/main      # Verify changed workspaces plus workspace dependents
yarn validate:test-governance --base origin/main # Validate test debt and reject new suppressions
```

Apps and `@openmrs/esm-patient-common-lib` extend `packages/tsconfig.json` directly.
The strict TypeScript migration is incremental. A workspace opts in by setting
`strict`, `noImplicitAny`, and `strictNullChecks` to `true` in its own
`tsconfig.json`; once enabled, these options must not be disabled.
The migration started with `@openmrs/esm-patient-common-lib`, which owns the shared Workspace v1/v2
contracts used by the clinical applications. `noUncheckedIndexedAccess` is a
separate follow-up phase; it is not part of TypeScript's `strict` flag.

Repository discipline and workspace ownership expectations should stay close to the touched package README and the relevant quality commands.

The test-governance validator uses
[`config/test-governance.json`](../../config/test-governance.json) as the
reviewed register of existing test debt.
Every workspace must expose a `test` script and contain a discoverable colocated
JavaScript or TypeScript test (`*.test.*` or `*.spec.*`). Existing gaps require
an accountable, risk-rated exception that expires within 180 days of the
register review date. Remove the exception when the first regression test
lands. CI compares each change with its Git base and rejects new exceptions and
new `--passWithNoTests` suppressions.

## Guías especializadas

- [Utilidades y tipos de pruebas compartidos](../../packages/test-utils/README.md).
- [Suites E2E, cuarentena, preflight y cobertura](../../e2e/README.md).
- [Recuperación y cleanup de fixtures sintéticos](synthetic-fixtures.md).
- [Aceptación offline en laptops](../runbooks/offline-laptop-acceptance.md).

No ejecutar suites clínicas contra producción ni con pacientes reales. Registrar
por separado pruebas ejecutadas, resultados de caché, typecheck, evidencia de
CI y aceptación del ambiente. Una auditoría de dependencias o un resultado
CodeQL aprobado no demuestra ausencia de regresiones funcionales.
