# Contributing to SIH Salus Frontend

Thank you for contributing. This repository contains clinical software:
patient safety, privacy, data integrity, and operational continuity take
priority over delivery speed.

These rules apply to people and automated agents. Before contributing, also read
the [Code of Conduct](CODE_OF_CONDUCT.md), the root [README](README.md), and the
README of every package you will modify.

## Non-negotiable rules

- Never use production, real patients, or PHI to develop, test, or document a
  change. Never commit or expose credentials, tokens, logs, or screenshots that
  contain sensitive or identifiable information.
- Clinical and E2E tests use authorized test accounts through secrets or
  environment variables and synthetic data in a coordinated environment. They
  must clean up or void any data they create.
- Do not claim that a validation passed unless you ran it against the reported
  diff or SHA. Use `NOT RUN` or `BLOCKED` and explain why.
- A typecheck, build, or unit test does not by itself prove that a clinical flow
  works against the deployed backend and content.
- Keep each PR focused on one outcome. Do not mix a fix with unrelated
  refactors, upgrades, or cleanup.
- Preserve unrelated changes in the worktree. Do not restore, delete,
  mass-format, or include files outside the requested scope.
- Opening or updating a PR does not authorize any merge. Agents must never merge
  without an explicit user instruction authorizing that exact merge.
- Tags, releases, promotions, and deployments require explicit authorization
  and must follow the [go-live runbook](docs/runbooks/frontend-go-live.md).
- The release workflow treats `main` and `pre-release` as release branches and
  may publish immutable images and move `latest` or `next` when its CI
  preconditions are met. `main` may also signal deployment to DEV/QLTY. Before
  merging into either branch, an authorized human maintainer must explicitly
  approve that consequence and confirm green checks, resolved conversations,
  domain review, and clinical or security approval when applicable.

If you find a vulnerability, secret, or exposed clinical data, do not publish
exploit details or sensitive data in a public issue or PR. Use
[GitHub private vulnerability reporting](https://github.com/sihsalus/sihsalus-frontend/security/advisories/new).
If that is unavailable, email `sihsalus@pucp.edu.pe` without sensitive details
and request a private channel.

## Preparing a change

### 1. Check the current context

Before editing:

```sh
git status --short --branch
git fetch origin
```

- If the work belongs to an existing PR, use only that PR's branch.
- For a new PR, first confirm that the worktree is clean or that you are in an
  authorized isolated worktree. Start from `origin/main` unless a maintainer
  specifies another base. Use a short, descriptive branch with a prefix such as
  `feat/`, `fix/`, `chore/`, `docs/`, `test/`, or `refactor/`:

```sh
git switch -c fix/area-description origin/main
```

- Do not reuse a branch that contains changes for another objective.
- Do not switch branches in a shared worktree with unrelated changes. Use an
  isolated worktree when authorized, or stop and request coordination.
- Review open issues and PRs to avoid duplicating work.
- Identify affected packages and consumers before changing a shared contract.

#### Preserve local work before integration

Record the original branch and HEAD, `git status --short`, staged and unstaged
diffs, untracked paths, and `git worktree list`. Inspect stash metadata without
restoring it into a shared worktree. A PR's commits do not necessarily contain
the user's local edits, and a clean worktree does not prove those edits were
integrated.

Prefer an isolated branch and worktree. If authorized work requires relocating
local changes, first make and verify a recoverable backup covering tracked and
untracked files. Record its location and original SHA privately; a patch alone
does not preserve untracked files. Keep secrets and authentication state out of
Git and public evidence. Protect any necessary local backup containing private
configuration with restricted permissions.

When using a stash, record its immutable object ID and purpose rather than
relying on `stash@{0}`, which changes as other stashes are created. Do not pop,
drop, or overwrite the original backup until restoration or integration has
been verified and cleanup is authorized. Compare the recovered files and
commit ancestry, not just PR titles. Separate duplicated or unrelated changes
without losing their original source; close a PR as superseded only when the
replacement and remaining scope are clear.

### 2. Define scope and risk

Before implementation, you must be able to answer:

- What observable problem does this solve, and what remains out of scope?
- Which packages, routes, workspaces, slots, or workflows does it modify?
- Can it affect visits, encounters, observations, orders, appointments, queues,
  patient identity, insurance, permissions, auditing, or offline behavior?
- Does it depend on endpoints, FHIR, OMODs, concepts, forms, UUIDs, roles, or
  specific content?
- Does it require a migration, coordinated rollout, feature flag, or rollback?

A clinical or cross-cutting change without verifiable answers should begin as
an investigation or draft PR, not as a claim of a complete solution.

## Repository contracts

Follow the repository's
[contracts that must not be broken](README.md#contratos-que-no-deben-romperse)
and these rules when applicable:

- Configurable concepts, forms, encounter types, visit types, identifiers, care
  settings, and other clinical UUIDs belong in `config-schema`, not hidden in
  components.
- Declare every cross-workspace dependency in `package.json`. Incremental
  validation relies on the manifest graph.
- Use shared constants for workspace, modal, route, and extension-slot names
  when a canonical source exists.
- A workspace launcher must respect the registered workspace version, props,
  and contract. Do not widen v1/v2 compatibility with loose types.
- Clinical and administrative entry points must fail closed in the frontend.
  Backend authorization remains authoritative.
- Never render raw error objects, endpoints, traces, or technical backend
  messages to users. Keep technical detail only in safe logging.
- User-visible text must use i18n and maintain both `en.json` and `es.json`. A
  raw translation key in the UI is a defect.
- Navigation order is a product contract, not a side effect of module load
  order. Use the existing extension-slot ordering mechanism and document its
  canonical owner. Keep related tasks adjacent without changing privileges,
  online/offline visibility, routes, or patient context. Cover duplicate or
  unknown IDs, optional modules, and allowed/denied access in regression tests.
- Do not assume a FHIR resource or OMOD works merely because an endpoint exists.
  Document the dependency, version, fallback, and missing-capability behavior.
- Do not save clinical data without an active visit or encounter when the flow
  requires one.
- When changing a local `@openmrs` fork or package, identify the upstream
  divergence, affected consumers, and required contract tests.
- A workspace that already uses strict TypeScript must not disable `strict`,
  `noImplicitAny`, or `strictNullChecks` locally.

Update the package README whenever functional boundaries, contracts,
backend/content requirements, permissions, fallbacks, or minimum validation
change.

## Local development

The supported environment uses Node 24 and Yarn 4.13.0:

```sh
corepack enable
yarn install --immutable
```

Follow the [Quick Start](README.md#quick-start) to build and serve the SPA. Never
commit `.env`, credentials, or private configuration. Self-signed certificates
are allowed only through explicit configuration in controlled environments.

Each worktree used for validation needs its own `node_modules` directory and
an immutable install for that branch. Never symlink the whole directory from
another worktree: workspace links can resolve sources or build outputs from
the wrong branch. Check real paths when reusing a temporary environment. A
package-manager download cache may be shared; workspace installations may not.
Documentation-only work may use an existing formatter without installing a
second dependency tree.

Use fail-fast execution (`set -e` in a shell script, or checked exit codes) for
dependent commands. Never continue from a failed merge or install into tests,
commits, or publication. Verify there are no unmerged paths before validation.
Limit concurrent builds/tests on constrained machines. If a timeout occurs,
record it and rerun the unchanged case with less contention before deciding
whether the test or implementation needs repair; do not hide it by weakening
assertions or increasing timeouts without evidence.

## Proportional validation

Not every PR needs every command, but every PR must explain what was and was not
run. After creating the PR's commits, the recommended baseline for code changes
is:

```sh
yarn verify:changed --base origin/main --head HEAD
```

Add the checks required by the scope:

| Scope                                            | Expected validation                                                                                                                                                                                                                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One workspace                                    | Scripts that exist and apply in its `package.json`, normally `lint`, `typescript`, `test`, and `build` when runtime or packaging changes. Validate relevant consumers too                                                                                                                    |
| Root configuration, tooling, or shared contracts | `yarn verify`, `yarn lint:all`, `yarn test:tooling`, `yarn typecheck:e2e`                                                                                                                                                                                                                    |
| Workspaces, routes, or permissions               | `yarn validate:workspaces`, `yarn validate:critical-route-privileges`, and `yarn validate:react-router` when navigation changes                                                                                                                                                              |
| Error handling                                   | `yarn validate:error-exposure --base origin/main --head HEAD` and a regression test for the visible error state                                                                                                                                                                              |
| Concepts or content defaults                     | `yarn validate:concepts` only against authorized DEV/QLTY. It covers extractable defaults, not all content; record `BLOCKED` when the environment or credentials are unavailable                                                                                                             |
| Dependencies or lockfile                         | `yarn install --immutable`, `yarn security:audit`, and applicable tooling tests                                                                                                                                                                                                              |
| Rspack, app-shell, import map, or SPA artifact   | `yarn build` and `yarn assemble`                                                                                                                                                                                                                                                             |
| Markdown documentation or templates              | `yarn prettier --check` followed by the modified paths, then `git diff --check origin/main...HEAD` after committing; use the actual PR base when different                                                                                                                                   |
| E2E                                              | Confirm that the changed suite is included in `e2e/tsconfig.json` before interpreting `yarn typecheck:e2e`. If excluded, create a focused `tsc` probe and disclose the exclusion; a Playwright config is not a typecheck. Separately run the applicable Playwright suite with synthetic data |

For a workspace, inspect its `package.json` first and run only scripts that
exist and apply:

```sh
PACKAGE_NAME=@sihsalus/esm-example-app
yarn workspace "$PACKAGE_NAME" lint
yarn workspace "$PACKAGE_NAME" typescript
yarn workspace "$PACKAGE_NAME" test
yarn workspace "$PACKAGE_NAME" build
```

`yarn validate:concepts` requires `SIHSALUS_BACKEND_URL` and test credentials
provided through the environment. Use it only against coordinated DEV/QLTY,
never production.

`yarn test` may use `--passWithNoTests`; a successful exit without discovered
tests does not count as a functional regression test. Report the number of
tests or cases actually executed.

High-risk changes—including patient chart, identity, workspaces, saving,
orders, queues, immunizations, offline behavior, and permissions—require a
manual smoke test or Playwright against a coordinated non-production
environment. The E2E workflow runs with the `e2e` label or manual dispatch; see
[e2e/README.md](e2e/README.md).

Before any remote test writes, confirm the explicitly authorized target,
authenticated test session, required privileges, metadata, and deployed build
SHA. DEV and QLTY evidence is environment-specific and is not interchangeable.
A reachable login page or a session endpoint returning HTTP 200 does not prove
authentication. On 401/403, stop dependent writes and request an authorized
test account through the local secret mechanism; never guess credentials or
paste them into issues, PRs, or chat.

Synthetic fixture setup must remain recoverable after partial failure. Persist
a minimal, access-restricted cleanup journal as resources are created, scope it
to the exact test target, and verify fixture ownership before deletion or voiding.
Retain unresolved state and report failed cleanup instead of swallowing errors
or removing the journal. Account for paginated dependent resources. Exercise
partial setup, retry, and cleanup failure locally before running a new fixture
harness against a shared backend. Never weaken a clinical acceptance criterion
merely to match whichever medication or concept happens to exist.

For every applicable validation, record:

- the exact command or case;
- status: `PASSED`, `FAILED`, `NOT RUN`, or `BLOCKED`;
- result and count when available;
- scope, environment, and SHA when not strictly local;
- relevant warnings, flakiness, and pre-existing failures. To call a failure
  pre-existing, reproduce it on `origin/main` or link prior evidence. Otherwise,
  write `not verified as pre-existing`.

Distinguish actually executed tests from cache hits and zero-test exits. After
resolving conflicts or integrating another branch, review and validate the
resulting diff again. Previous SHA evidence can explain provenance, but cannot
be presented as a current-SHA clinical smoke. If credentials, content, or an
external service block a required check, finish safe local validation, retain
the draft, and identify the exact external blocker and next owner/action.

## Tests and regressions

- A fix must include a test that fails for the original defect whenever
  technically feasible.
- New workspaces must declare a `test` script and include at least one
  discoverable test. Do not add `--passWithNoTests`. Time-bounded legacy gaps
  are recorded in `config/test-governance.json`; remove the exception when a
  test lands instead of renewing it by default.
- Test behavior and contract boundaries, not only snapshots or implementation
  details.
- Permission changes require both allowed and denied paths.
- Network, backend, or offline changes must cover the relevant loading, empty,
  error, reconnection, and expired-session states.
- For manual clinical testing, record the role, synthetic data, result, and
  cleanup. Never attach PHI to evidence.
- If an automated regression is not feasible, explain the concrete reason and
  alternative validation. Do not write only "not applicable."

## Commits and PR title

Use small commits and conventional titles:

```text
type(scope): imperative, specific summary
```

Common types are `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `build`,
and `ci`. Examples:

```text
fix(registration): preserve location for required identifiers
test(e2e): cover odontogram save without service worker
docs(contributing): define the pull request contract
```

Use `Closes #123` only when the PR fully resolves the issue. For partial work,
link the issue without closing it automatically.

## Preparing the pull request

GitHub will load [the PR template](.github/pull_request_template.md). Preserve
every section and complete every line. If something does not apply, write `N/A`
and give the reason. The body must let another person review the change without
reconstructing the investigation from scratch.

Before publishing or updating the PR:

1. Review `git status`, the commits, and the complete diff against
   `origin/main`.
2. Confirm that the diff has no unrelated changes, secrets, real data, or
   accidental generated artifacts.
3. Explain the outcome, cause, included scope, and deliberately deferred work.
4. Complete the impact matrix without ambiguous sections.
5. Record every applicable validation. Use `PASSED` only for checks run against
   the current diff or SHA.
6. Add screenshots only when useful and free of sensitive data.
7. Mark the PR as draft when decisions, access, backend/content, or clinical
   validation remain pending.
8. Request the `e2e` label and coordinate QLTY when the risk requires it.
9. Leave the PR for maintainer review and decision. Preparation alone does not
   authorize a merge; follow the separate authorized-integration procedure below.

When using GitHub CLI, first prepare a file containing the completed template:

```sh
PR_BRANCH=docs/description
PR_BODY_FILE=/tmp/sihsalus-pr-body.md
gh pr create \
  --base main \
  --head "$PR_BRANCH" \
  --title "type(scope): summary" \
  --body-file "$PR_BODY_FILE"
```

Set `PR_BRANCH` and `PR_BODY_FILE` to real values first. Replace `main` only
when a maintainer specifies another base branch.

CI runs the declared scripts and controls, but some tests allow
`--passWithNoTests`, and E2E runs only with a label or manual dispatch. CI does
not replace clinical, backend/content, or role-based validation. A green check
is technical evidence, not deployment authorization.

## Authorized integration and handoff

Only after explicit authorization covering the merge and its release effects:

1. Resolve the exact PR head and base; review the complete diff, conversations,
   required domain/clinical approvals, and checks for that head. An older green
   run, skipped E2E, or a mergeable status is insufficient. Do not bypass checks
   or protections. Recheck the head immediately before merging.
2. Merge focused changes in dependency order. Revalidate any conflict resolution
   or changed combination. A major dependency bump is neither automatically
   safe nor automatically incompatible: check supported runtime, public types,
   consumers, packaging, and applicable tests; record a concrete incompatibility
   before closing a dependency PR on that basis.
3. Monitor the resulting `main` CI, then the release workflow and relevant
   environment health as separate outcomes. Verify the SHA actually built, not
   only the workflow-run label. If the branch advances while an image is built,
   the stale-head guard may correctly refuse promotion; wait for the newer
   authorized pipeline rather than forcing an older release. A merge does not
   authorize manual infrastructure repairs or a different deployment.
4. Report merged PRs, drafts and blockers, failing/skipped checks, deployment
   evidence, and the location of preserved local work. Return to `main` when
   requested only after the worktree is clean or the changes are safely isolated;
   fast-forward it without discarding work. Do not promise a bug-free system or
   describe pending clinical validation as complete.
