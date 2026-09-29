# Frontend modernization: compiler, dependencies and bundles

This iteration combines the [native TypeScript migration](typescript-native.md)
with removal of unused dependencies and smaller production icon bundles. It does
not change clinical persistence, permissions, navigation or backend contracts.

## Build pipeline

Microfrontends and the styleguide use Rspack's `builtin:swc-loader`. Its options
follow the existing SWC loader contract; TypeScript checking remains a separate
required task. The styleguide's React transform belongs under `jsc.transform`,
not inside `jsc.parser`.

The root JavaScript `swc-loader` remains necessary for the upstream Webpack app
shell and the local offline E2E harness. Replacing the Rspack loaders does not
justify removing that Webpack dependency. See the
[Rspack migration documentation](https://rspack.dev/guide/migration/webpack).

The shared transform also processes `@carbon/icons-react`. Some installed Carbon
icon buckets call `React.forwardRef` without purity annotations, retaining unused
icons during minification. SWC's React transform supplies those annotations. This
uses the compiler's import-aware transform, without modifying vendor files or
assuming arbitrary function calls have no side effects. Other third-party
packages keep the existing exclusion rule.

`rspack-native-loader.test.js` compiles and executes typed JSX with both actual
loader configurations. A separate production bundle test uses the Carbon version
resolved by RBAC, compares the rendered icon with the original SVG (including size
and accessible attributes), and checks that one icon does not retain a whole
bucket. Restoring the old exclusion rule fails that size regression.

## Dependency removal

The cleanup removes 26 dependency declarations across 13 workspaces and 31 package
resolutions from the lockfile, without adding a package resolution. Removal was
checked against source imports, tests, scripts, configuration and consumers;
static analyzer findings alone are insufficient.

Three unused appointment spreadsheet helpers were copied into Consulta Externa,
CRED and Salud Materna. Removing these copies deletes 421 lines and their ExcelJS
declarations. The live appointment exporter, FUA export and patient import retain
ExcelJS. Other removals include the unused Konva renderer, old image gallery,
webcam declaration, file loader and unused form/search dependencies. Clinical
cross-workspace dependencies and stylesheet dependencies remain declared.

Knip's current Rspack configuration reader invokes application factories from the
repository root, where the required app `routes.json` is absent. A static-only
scan with the Rspack/Webpack plugins disabled was used for investigation, followed
by manual consumer checks. That scan is not a clean repository dependency audit;
the normal Knip command still needs its configuration-loading integration fixed.

## Measurements

Measured locally on macOS arm64 with Node 24.15.0. The Home baseline was built at
`dac344e1c`; the optimized artifact uses the same locked Carbon versions, production
mode and application source. Totals cover **all emitted JavaScript chunks**, not
just the initial route or actual network requests. Compression is per file using
Node's default `gzipSync` and `brotliCompressSync` settings.

| Home JavaScript | Before (bytes) | After (bytes) | Reduction |
| --------------- | -------------: | ------------: | --------: |
| Uncompressed    |         880218 |        525126 |     40.3% |
| gzip            |         252198 |        172204 |     31.7% |
| Brotli          |         216429 |        149129 |     31.1% |

The loader-only experiment showed less than 2% difference in median build time
for Home and Consulta Externa (one warmup, three alternating runs per loader,
Rspack cache disabled). That difference is not evidence of a meaningful build
speedup. The measured compiler gains are recorded separately in the TypeScript
migration document. No page-load latency, backend speed or clinical E2E result is
inferred from bundle size or compiler timings.

## Validation and rollout

Run immutable installation, security audit, tooling tests and
`yarn verify:changed --base origin/main --head HEAD`. The shared Rspack/styleguide
change also requires the full build and SPA assembly, E2E typechecking and a
local development build. Confirm icons, permissions, styles and keyboard behavior
in coordinated synthetic DEV/QLTY before release. Local component and SVG tests
do not establish deployed browser or clinical acceptance.
