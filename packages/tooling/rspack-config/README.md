# @openmrs/rspack-config

OpenMRS 10.0.0 Rspack configuration for SIH Salus modules. This local fork uses
Rspack 2 and `ModuleFederationPluginV1` so it can share runtime modules with the
repository's app shell. Its CommonJS output is consumed through
`openmrs/default-rspack-config` by the app workspaces.

The shell provides `swr`, `swr/infinite`, `swr/immutable` and `swr/_internal`
from one module graph; microfrontends consume those singletons without local
fallbacks. Sharing only `_internal` does not share SWR 2.5's cache, context and
revalidation state across independently bundled roots. The browser regression
in `styles.browser.spec.js` compiles the native Webpack host and Rspack remotes
and verifies observation, immutable and paginated history refresh after a saved
close, while another patient's cache and metadata remain unchanged. Changes to
this contract require rebuilding both the shell and consuming microfrontends.

The OpenMRS 10 SVG rule imports markup as text for the shared icon and
pictogram registries. Imports with `?url` emit a file URL for `<img>` consumers
in the home and offline tools apps. PNG, JPEG and GIF files remain emitted assets. A local
development build with a port enables Rspack lazy compilation, while a
production build emits the complete module. The development server serves
compiled assets from memory; production output is written to `dist`.

Validate changes with `yarn workspace @openmrs/rspack-config build`,
`yarn test:styles`, the full monorepo build, and `yarn assemble`. Changes to
shared dependencies or module output also require consumer builds and a
coordinated synthetic DEV/QLTY smoke test before release.
