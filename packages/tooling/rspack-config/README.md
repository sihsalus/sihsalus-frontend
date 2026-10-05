# @openmrs/rspack-config

OpenMRS 10.0.0 Rspack configuration for SIH Salus modules. This local fork uses
Rspack 2 and `ModuleFederationPluginV1` so it can share runtime modules with the
repository's app shell. Its CommonJS output is consumed through
`openmrs/default-rspack-config` by the app workspaces.

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
