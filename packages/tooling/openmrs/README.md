# openmrs

The one stop CLI for using the OpenMRS 3.0 Frontend app.

## Prerequisites

This SIH Salus fork requires Node.js 24 or later; use the repository's supported
Node 24 and Yarn versions for development and validation.

## OpenMRS 10 tooling and shell packaging

The framework workspaces, npm app shell, and this local CLI use OpenMRS 10.0.0.
The CLI keeps the repository's CommonJS entry point and Rspack 2 integration;
upstream 10.0.0 uses ESM and Rspack 1. Its OpenMRS 10 behavior is ported onto
these local contracts rather than replacing them with an incompatible build.
`openmrs develop` waits for each local module's first successful compilation
before publishing its dynamic import map. Invalid or failed local builds stop
startup instead of advertising an unavailable module.
The app shell is patched with the repository's source-build configuration so the assembled SPA
still includes the repository-owned service worker, branded manifest, and safe
localized startup errors. Validate the patch with
`node --test packages/tooling/scripts/build-app-shell.test.js`, then build and
assemble the SPA. The upstream Rspack configuration alone does not emit this
repository's required service worker.

## CLI startup contract

The CommonJS entry point creates a parser with the
[yargs 18 factory and `hideBin(process.argv)`](https://github.com/yargs/yargs/blob/v18.1.0/README.md#usage).
Do not use the removed singleton API: it prevents every command, including
`--help`, from starting. This also affects `yarn start`, `yarn serve`, and the
clinical/laboratory E2E web server.

`yarn workspace openmrs test` exercises the emitted CommonJS with the installed
yargs: root/command help must exit successfully, unknown options must fail, and
explicit/default `start` must preserve typed arguments. These local regressions
replace command side effects and require no backend, browser or credentials.
After `yarn workspace openmrs build`, also check `yarn openmrs --help` against the
compiled entry point. Clinical E2E acceptance remains a separate environment gate.

## Installation

You can run the tool without installation using `npx`, which is part of NPM. Just make sure to fulfill the prerequisites.

Alternatively, install the application globally using `npm i openmrs -g`. Then you can run the tool without `npx`, e.g., instead of `npx openmrs ...` you run `openmrs ...`.

## Available Commands

The following commands are available. For an up-to-date help on your installation run `npx openmrs --help`.

The `--help` flag can also be applied to any command below, resulting in detailed information about the available options.

### `start`

> For developers.

Starts the app shell configured for the SPA reference application. Includes a default import map working against a working snapshot on the CDN.

With `--open`, the CommonJS CLI loads the browser launcher's ESM default export
only after the server is listening. A module-loading or browser-launch failure
must leave the server running and show the existing safe warning. Headless
environments should omit `--open`.

Example:

```sh
# run the command
npx openmrs
```

### `develop`

> For developers and implementers.

Performs a debug build of the app shell and runs it against a given OpenMRS backend. Can be proxied to any network and used with any import map configuration.

Example:

```sh
# run the command
npx openmrs develop
```

### `build`

> For implementers.

Builds the app shell with a given configuration. Provides the assets necessary for the app shell in a distribution.

Example:

```sh
# run the command
npx openmrs build
```

### `assemble`

> For implementers.

Assembles an import map incl. assets to provide the frontend module assets for a distribution.

Example:

```sh
# run the command
npx openmrs assemble
```
