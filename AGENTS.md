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
- Inventory staged, unstaged, untracked changes and existing worktrees before
  integrating local work. Record the original branch and SHA; verify a
  recoverable backup before relocating changes. Never drop a user's stash as
  routine cleanup. See the preservation procedure in `CONTRIBUTING.md`.
- Give each validating worktree its own dependency installation. Do not share
  a `node_modules` symlink across branches; workspace links can silently test
  another worktree. Run dependent shell steps with fail-fast behavior and
  resolve all merge conflicts before validation.
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
- Treat navigation order as a product contract. Prefer the existing extension
  slot configuration over competing per-module positions or a second sorter;
  preserve permissions, visibility conditions, routes, and translated labels.
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
- Distinguish cached results, executed tests, skipped E2E, PR CI, release, and
  deployed-build evidence. Revalidate the final diff after conflict resolution;
  an older green SHA does not validate newly integrated behavior.
- E2E and clinical tests use synthetic data only in a coordinated DEV/QLTY
  environment, never production. If access is unavailable, exhaust local checks
  and block only the external validation.
- Preflight the authorized target, session, permissions, and required content
  before creating fixtures. Keep recoverable synthetic cleanup state until
  cleanup succeeds; never swallow cleanup failures or delete unverified data.

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
- For an authorized merge, verify checks and conversations on the exact PR
  head, include required domain/clinical approval, and never bypass gates.
  Monitor the resulting main CI separately from release and environment
  health. A stale-image promotion guard is not permission to rerun or deploy
  an older build. Finish with the requested branch clean or explain the
  preserved local changes and remaining blockers.

## Security reporting

Do not publish vulnerabilities, secrets, or clinical data in issues or PRs. Use
[GitHub private vulnerability reporting](https://github.com/sihsalus/sihsalus-frontend/security/advisories/new),
or ask `sihsalus@pucp.edu.pe` for a private channel without including sensitive
details.
