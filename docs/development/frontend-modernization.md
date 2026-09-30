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
resolutions from the lockfile, without adding a package resolution. Ace, already
installed transitively, is now declared directly by Form Builder. Removal was
checked against source imports, tests, scripts, configuration and consumers;
static analyzer findings alone are insufficient.

Three unused appointment spreadsheet helpers were copied into Consulta Externa,
CRED and Salud Materna. Removing these copies deletes 421 lines and their ExcelJS
declarations. The live appointment exporter, FUA export and patient import retain
ExcelJS. Other removals include the unused Konva renderer, old image gallery,
webcam declaration and unused form/search dependencies. Form Builder replaces
Ace's legacy `file-loader` resolver with explicit JSON/theme/search imports and
a locally emitted JSON worker; its synthetic browser test covers those assets. Clinical
cross-workspace dependencies and stylesheet dependencies remain declared.

The initial investigation disabled Knip's Rspack/Webpack plugins because their
configuration reader invokes build factories outside the owning workspace.
The September 30 maintenance pass below replaces that workaround: only runtime
configuration loading is excluded, while plugin visitors and statically traced
build configuration entry points remain active.

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

## Follow-up measurements (2026-09-29)

The follow-up uses base `59ed12d0af3814a7f343175704fe56082de6bd4e` and the
Stock lifecycle change. It keeps all 43 exports and the existing route and
privilege registrations. Eleven screens and print previews use the existing
OpenMRS asynchronous lifecycle; navigation links remain synchronous.

The Rspack comparison used the same production settings and dependency
installation on macOS arm64, Node 24.20.0:

| Stock JavaScript       | Before (bytes) | After (bytes) | Reduction |
| ---------------------- | -------------: | ------------: | --------: |
| Main entrypoint        |         619261 |         45792 |     92.6% |
| Main entrypoint, gzip  |         174724 |         15099 |     91.4% |
| All emitted JavaScript |        2525768 |       2039702 |     19.2% |

A separate Chromium probe used both Stock builds compiled on DEV (Linux amd64,
Node 24.21.0) and the same app shell. Opening Stock Settings requested 665919
bytes of Stock JavaScript before the change and 113339 after it (83.0% less,
uncompressed). This counts the module's actual requested files, not shared
framework assets or total page traffic. It is not a page-latency benchmark.
The synthetic probe loaded all eleven lifecycles, exercised allowed and denied
access, and recovered after an intentionally failed chunk download. It used
mocked sessions, blocked external requests and disabled service workers; it
does not establish backend, clinical or offline acceptance.

A separate Vitest experiment on DEV used two workers, default isolation, one
warmup and three alternating measurements per pool. All runs executed the same
135 Stock tests in 22 files. Median wall time was 56.622 seconds with `forks`
and 54.033 seconds with `threads` (4.6% less). That isolated gain was insufficient
to justify changing the repository default. A temporary Carbon dependency
optimizer experiment failed to load 19 test files because its generated ESM
required `react/jsx-runtime`; it was not incorporated and its duration is not a
successful-test measurement. No shared Vitest configuration or permanent
benchmark harness was added.

Workspace lint keeps the existing Biome configuration and path handling, but
its helper now invokes Biome's installed CLI with Node directly. It no longer
starts another Yarn process or maintains a separate Yarn-path and Windows-shell
resolver. Turbo includes this helper in lint task inputs so a helper change
invalidates cached lint results.
On macOS arm64 with Node 24.20.0, one warmup and five alternating runs of lint
on Stock's `src/index.ts` reduced median helper wall time from 569 ms to 51 ms
(91.0%). This isolates wrapper startup and one file; it does not measure total
CI lint time. Workspace-relative and absolute paths were checked, and a temporary
fixture violating the root import rule still returned a failing exit status.

Docker installs dependencies from root and workspace manifests before copying
application source. An isolated source-only edit on DEV reused the installation
layer; checking the `dependencies` target took 2.991 seconds. The install layer
was 1.883 GB with project-local hardlinks versus 2.265 GB previously (16.9% less).
This measures a build layer, not the published image. The complete uncached
90-package compilation took 9m33s versus 9m28s before the change on the same
two-CPU DEV host: there is no demonstrated cold-compilation gain. Installation
durations are not compared because the download cache was warm in later runs.
DEV exposes two VMware vCPUs on an Intel Xeon E5-2630 v4 at 2.20 GHz. During
the later full unit-test run, two one-second `vmstat` samples showed 99% CPU
busy and no I/O wait or CPU steal. That run also overlapped image validation;
its wall time is compatibility evidence rather than a controlled CI benchmark.

The starting GitHub evidence separates compilation from tests and packaging:

| Phase                         | Observed time | Evidence                                             |
| ----------------------------- | ------------: | ---------------------------------------------------- |
| Lint, typecheck and build     |         6m07s | CI run `36628186863`; 270 tasks, no Turbo cache hits |
| Unit-test task graph          |        16m43s | Same run; 115 tasks, 25 Turbo cache hits             |
| SPA assembly                  |         1m15s | Same run; separate build reused all 90 build tasks   |
| Image dependency installation |         1m04s | Image run `36632460105`                              |
| Image compilation             |         2m50s | Same image run; 90 tasks, no Turbo cache hits        |
| Image export                  |           52s | Same image run                                       |
| GitHub Actions cache export   |         3m56s | Same image run                                       |

These are observations from different jobs, not a controlled before/after
comparison. In particular, saving compiler time does not imply the same saving
in total CI or deployment time. The revised dependency-layer reuse still needs
measurement in GitHub Actions after integration.

For subsequent task-level measurements, use Turbo's native reporting rather
than a custom timing script: `yarn test --summarize --log-file` retains the
existing test graph, UTC timezone and concurrency. Run summaries are written
under `.turbo/runs/` and structured logs under `.turbo/logs/`. Keep cache-hit
status with each duration; a cached task does not measure test execution.
The reporting flags were verified with a cached Stock lint task; that check
does not add another executed functional test.

The complete DEV build also reported large assets in Odontologia (an asynchronous
chunk of 1985 KiB), Form Engine (main entrypoint of 1382 KiB) and Patient Tests
(main entrypoint of 1068 KiB). These are candidates for route-level browser
profiling; emitted size alone does not establish whether a user downloads a
chunk on the first screen. The nine exceptions in `config/test-governance.json`
also remain part of the baseline: successful workspace commands do not imply
complete clinical regression coverage.

The candidate `secure-init` image was tested by its local immutable ID
`sha256:5e97741c57fefc5494227c7018e8396ab4fc0389bfa186523149683f52eebe47`.
Trivy 0.70.0, using the database downloaded on 2026-09-29, scanned Alpine and
Node packages with the release gate's `HIGH,CRITICAL` / `ignore-unfixed`
threshold: **PASSED**, zero findings at that threshold. This is candidate
evidence, not a published release or deployment.

Both the default init assembly and the three existing `yarn assemble` steps
(`generate-assemble-config.js`, `assemble-importmap.js`,
`validate-spa-artifact.js`) passed inside that image as a non-root user without
network access. The configured run resolved all 67 expected modules locally.
Chromium checks using assets extracted from the same image passed allowed and
denied access, all eleven lifecycle loads, and failed-chunk recovery; the
Settings request total remained 113339 bytes with no page errors.

The full DEV `yarn verify` completed successfully: 270 lint/typecheck/build
tasks executed without Turbo cache hits (26m33s), followed by 115 successful
tasks in the unit-test graph with 25 cache hits for build prerequisites (58m20s).
DEV E2E typechecking also passed, reusing all ten prerequisite builds. This
run used the application/dependency candidate before the lint-helper cleanup;
the final helper was separately checked across all 91 lint tasks below.

The subsequent DEV tooling command initially passed 199 of 200 tests. Its
governance CLI test failed because the archive-based validation checkout had
no `origin/main` ref. Importing the actual base commit and tree into that
temporary checkout allowed the affected test to pass unchanged on retry.
This fixes the validation environment; it is not a repository test change.
The original temporary Docker validation target therefore exited with an error,
and its later lint/audit/help steps did not run. Final lint and tooling evidence
is recorded below; the same dependency candidate's separate DEV
`yarn security:audit` passed, as did the final image scan.

Final tooling checks on macOS arm64, Node 24.20.0:

| Command                                      | Status | Scope                                                                   |
| -------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| `yarn lint`                                  | PASSED | 91 tasks executed, no cache hits; final Biome helper                    |
| `yarn lint:all`                              | PASSED | 5863 files; 919 warnings and 8 informational diagnostics remain         |
| `yarn test:tooling`                          | PASSED | 200 tests, no failures or skips                                         |
| `yarn typecheck:e2e`                         | PASSED | Both E2E TypeScript projects; prerequisite build had 10 tasks, 8 cached |
| `yarn prettier --check` on modified Markdown | PASSED | Documentation formatting                                                |
| `git diff --check`                           | PASSED | Uncommitted change whitespace                                           |

The separate `spa-artifact` target attempt was stopped after BuildKit rebuilt
missing cache references and began recompiling unchanged packages. The three
assembly commands above were completed in the already-built image instead;
the interrupted target is not reported as a successful build. No permanent
benchmark script, new dependency, test-pool change or deployment was added.

## Integration revalidation

The follow-up was integrated without conflicts onto `6469b8c7e` after the
subsequent dependency updates. Measurements and DEV image results above remain
evidence for the recorded original base, not benchmarks of the updated dependency
graph. Final-head validation is recorded in the integration PR: focused local
tooling and Stock checks, followed by the existing CI gates for full verification,
SPA assembly, browser style contracts, E2E typechecking and dependency audit.
This avoids repeating the full DEV run while still validating the integrated
code. No clinical persistence, route registration or privilege policy changes
are included.

## Validation and rollout

Run immutable installation, security audit, tooling tests and
`yarn verify:changed --base origin/main --head HEAD`. The shared Rspack/styleguide
change also requires the full build and SPA assembly, E2E typechecking and a
local development build. Run `yarn test:styles` and
`yarn test:form-builder-browser` with local Chromium for browser asset checks.
Confirm icons, permissions, styles and keyboard behavior
in coordinated synthetic DEV/QLTY before release. Local component and SVG tests
do not establish deployed browser or clinical acceptance.

## Maintenance baseline (2026-09-30)

Source reference: `b6141950294712f0ad2634d4ca9b19edb0a6f174`. Measurements below
are a prioritization baseline, not a new before/after performance claim.

Knip now skips executing Rspack/Webpack configuration factories by setting each
plugin's `config` patterns to an empty array. Application and library build
configurations remain explicit static entry points. Both plugins remain enabled,
including the visitor that discovers `require.context` dependencies. This permits
analysis after an immutable install without first compiling build-tool workspaces
or running application factories with the repository root as their working directory.
A synthetic CLI regression proves that lazy imports and context-loaded modules stay
reachable while a truly unused file is reported; the fixture's build factory throws
if evaluated. No exit-code suppression or new global dependency ignore is introduced.

`yarn knip --reporter json` still exits 1 when it finds candidates. This is a
completed analysis, not a clean audit or permission to delete every reported item.
Review scripts, styles, tests, Module Federation contracts, extension registrations
and downstream workspaces before removing any declaration or export. In particular,
public framework exports and clinical registrations can be consumed outside a
single workspace's static import graph.

The following sizes sum emitted JavaScript files from the six selected production
builds, with per-file gzip using Node defaults. Shared/runtime assets can be present
in multiple output directories: do not sum rows as a page-download estimate.

| Application      | Emitted JS bytes | Per-file gzip bytes | Largest emitted JS bytes |
| ---------------- | ---------------: | ------------------: | -----------------------: |
| Consulta Externa |        1,728,193 |             566,819 |                  421,836 |
| Laboratory       |          939,974 |             305,738 |                  324,191 |
| Pharmacy         |          785,574 |             251,172 |                  195,819 |
| Patient Tests    |        3,000,328 |             675,613 |         1,093,384 (main) |
| Odontologia      |        2,706,745 |             383,753 |        2,032,014 (async) |
| Form Engine      |        3,509,958 |             903,030 |         1,415,451 (main) |

A synthetic Chromium registration probe requested 1,098,737 bytes across four
Patient Tests JavaScript assets to resolve its `./start` exports. It used the actual
production Module Federation artifact with shared host services simulated, UTF-8
responses, a fresh browser context and all external network requests blocked. All
nine exports resolved. This isolates module registration; it is not a clinical
screen render, backend latency measurement or complete SPA download size.

Environment: macOS arm64, Node 24.15.0, Yarn 4.18.1. The selected build graph
completed 30 tasks in 17.920 seconds, with 24 cache hits. This is neither a cold-build
time nor a user-facing latency measurement. An initial sandboxed attempt failed
because SWC could not materialize its native cache; rerunning with filesystem access
passed without application changes. No local Docker was used. DEV preflight showed
8.3 GiB free and approximately 3.9 GiB available RAM; availability is transient.

GitHub provides a separate reference for total validation time:

| Run / phase                                                                                            | Duration | Interpretation                                         |
| ------------------------------------------------------------------------------------------------------ | -------: | ------------------------------------------------------ |
| [CI 36654174473](https://github.com/sihsalus/sihsalus-frontend/actions/runs/36654174473), quality job  |    120 s | Includes setup and cache restoration                   |
| Same run, full verification step                                                                       |     67 s | Cache participation must be retained when comparing    |
| Same run, build step                                                                                   |      1 s | Reused outputs; not compilation speed                  |
| Same run, SPA assembly                                                                                 |     56 s | Remaining serial packaging work                        |
| Same run, Node/Yarn setup across jobs                                                                  |  39–61 s | Separate per-job preparation cost                      |
| [Image 36675429030](https://github.com/sihsalus/sihsalus-frontend/actions/runs/36675429030), build job |    371 s | Verification image, different SHA `a3ddd7453`          |
| Same image run, Buildx step                                                                            |    335 s | Includes build/export/cache work, not only compilation |

Next measurements should prioritize actual requested assets for Patient Tests and
Form Engine before changing their loading boundaries. Odontologia's large async
chunk needs profiling of its contents; its size alone does not justify splitting
code needed together. Keep browser/network measurements with synthetic data,
backend timing and cache state separate from artifact sizes. Use existing Turbo
summaries, Rspack stats and browser tooling rather than a new benchmark framework.
