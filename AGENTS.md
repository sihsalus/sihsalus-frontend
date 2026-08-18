# AGENTS.md

Instructions for coding agents working on SIH Salus Frontend. This file follows
the open [AGENTS.md](https://agents.md/) format and applies to the entire
repository. Explicit user instructions take precedence over this file and
define the task's scope and authorization. Do not infer permission for merges,
releases, deployments, production access, PHI handling, or other
safety-sensitive actions from a broader request. A closer `AGENTS.md` takes
precedence within its subtree; nested files should preserve these repository
safety policies.

## Project overview

- Clinical OpenMRS 3 monorepo using single-spa microfrontends, TypeScript, Yarn,
  and Turborepo.
- Patient safety, privacy, data integrity, and operational continuity take
  priority over delivery speed.
- Read `CONTRIBUTING.md` completely before editing any file. It is the normative
  source for scope, evidence, risk, and pull request requirements.
- Also read the root README, the affected package README, and any applicable
  clinical or technical contracts.

## Setup commands

Always inspect the current state before changing files:

```sh
git status --short --branch
```

When the task requires dependencies, prepare the supported environment:

```sh
corepack enable
yarn install --immutable
```

- Preserve unrelated work. Do not clean, restore, or mass-format files outside
  the requested scope.
- An existing installation is sufficient for documentation-only work.
- Follow the Quick Start in `README.md` to run the SPA. Do not improvise backend
  URLs, credentials, or environment variables.

## Code style and repository contracts

- Keep the change minimal and aligned with the requested outcome.
- Use the workspace's existing scripts and conventions. Do not introduce a
  second tool for a problem already covered by the monorepo.
- Declare cross-workspace dependencies in `package.json`.
- Keep configurable clinical UUIDs in `config-schema`, workspace names in shared
  constants, and user-visible text in both `en.json` and `es.json`.
- Do not weaken route/RBAC guards, safe error handling, or TypeScript options
  that are already strict.
- Never use production, PHI, or real patients. Never expose secrets or
  credentials in code, tests, logs, screenshots, or documentation.

## Testing instructions

After creating the change's commits, use this as the baseline for code changes:

```sh
yarn verify:changed --base origin/main --head HEAD
```

- Inspect the affected `package.json` and run the applicable `lint`,
  `typescript`, `test`, and `build` scripts. Validate relevant consumers too.
- For Markdown changes, run `yarn prettier --check` followed by the modified
  paths, then run `git diff --check origin/main...HEAD` after committing. Use
  the actual PR base when it is not `main`.
- Use the validation matrix in `CONTRIBUTING.md` for workspaces, routes/RBAC,
  errors, concepts, dependencies, SPA packaging, and E2E.
- Do not treat `--passWithNoTests` as a functional regression test, or a
  typecheck/build as clinical validation.
- Record every applicable validation as `PASSED`, `FAILED`, `NOT RUN`, or
  `BLOCKED`, with the command, result, scope, and SHA/environment when relevant.
- E2E and clinical tests use synthetic data only in a coordinated DEV/QLTY
  environment, never production. If access is unavailable, exhaust local checks
  and block only the external validation.

## Pull request instructions

- Create or switch branches only when the request authorizes preparing a PR and
  the worktree is clean or isolated. Never switch branches in a shared worktree
  containing unrelated changes.
- For a new PR, use a separate branch from `origin/main` by default. For an
  existing PR, work only on its branch. Do not combine unrelated objectives.
- Use a conventional title: `type(scope): summary`.
- Complete `.github/pull_request_template.md` without deleting sections. Use
  `N/A` with a concrete reason and disclose every pending validation.
- Review the full diff against the base and exclude unrelated changes,
  artifacts, secrets, and identifiable data before publishing.
- Publish or update a branch and PR only when the request authorizes it.
- Opening or updating a PR does not authorize any merge. Merge only when an
  explicit user instruction authorizes that exact merge. Treat merges into
  `main` or `pre-release` as release-affecting: the configured workflow can
  publish immutable images and move `latest` or `next` after successful CI, and
  `main` can signal DEV/QLTY deployment. Generic authorization to prepare a PR
  is insufficient.
- If a missing decision or authority could change the outcome, stop and ask
  only for what is required.

## Security reporting

Do not publish vulnerabilities, secrets, or clinical data in issues or PRs. Use
[GitHub private vulnerability reporting](https://github.com/sihsalus/sihsalus-frontend/security/advisories/new),
or ask `sihsalus@pucp.edu.pe` for a private channel without including sensitive
details.
