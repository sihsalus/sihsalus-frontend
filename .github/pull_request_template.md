<!--
Before preparing this PR, read and follow /CONTRIBUTING.md.
Preserve every section. If something does not apply, write “N/A” and explain why.
Opening or updating this PR does not authorize any agent to merge it.
-->

## Outcome and scope

- Problem or issue:
- Observable change:
- Affected packages, routes, or workspaces:
- Out of scope or deferred debt:

## Impact

<!--
Complete every line. “N/A — <reason>” is valid; leaving it blank or keeping the
placeholder is not. Consider visits, encounters, orders, queues, identity,
offline/sync, FHIR/OMODs, concepts/UUIDs, routes, props, slots, RBAC,
accessibility, UI states, PHI, logs, sessions, service workers, and consumers.
-->

- Clinical and data: `<impact or N/A — reason>`
- Backend, content, and configuration: `<impact or N/A — reason>`
- Workspaces, routes, and permissions: `<impact or N/A — reason>`
- i18n and UI: `<impact or N/A — reason>`
- Security and privacy: `<impact or N/A — reason>`
- Compatibility, migration, and consumers: `<impact or N/A — reason>`

## Validation evidence

<!--
Record every applicable validation. Use PASSED only for validation run against
this diff/SHA; use NOT RUN or BLOCKED for pending validation and explain why.
Compiling, visual inspection, or --passWithNoTests without discovered tests does
not demonstrate functional behavior.

Allowed states: PASSED, FAILED, NOT RUN, BLOCKED.
Delete the example row and add as many rows as required.
-->

| Status     | Command or case     | Exact result                          | Scope, environment, and SHA    |
| ---------- | ------------------- | ------------------------------------- | ------------------------------ |
| `<STATUS>` | `<command or case>` | `<exit code; N/N; result or failure>` | `<package/local/DEV/QLTY/SHA>` |

- Automated regression added or updated:
- Manual or E2E test: role, synthetic data, assertion, and cleanup:
- Warnings, flakiness, or pre-existing/unrelated failures: `<evidence on origin/main or prior issue; otherwise “not verified as pre-existing”>`

## Risk, rollout, and rollback

- Risk level: low / medium / high — rationale:
- Rollout or coordination requirements:
- Stop or rollback signal:
- Rollback procedure, or `N/A` with reason:

## Final checklist

- [ ] The diff matches the scope and contains no unrelated changes or accidental artifacts.
- [ ] New or corrected behavior has a regression test, or the concrete reason why not is documented.
- [ ] Applicable affected packages and relevant consumers were validated, not only the edited file.
- [ ] The impact matrix and documentation reflect changed contracts, or explain why they do not apply.
- [ ] Every `PASSED` entry corresponds to the current diff/SHA, and failures called pre-existing have evidence.
- [ ] There are no secrets, PHI, real patients, or identifiable screenshots or logs.
- [ ] Any clinical test ran outside production with synthetic data and recorded cleanup.
- [ ] High-risk clinical changes record manual-smoke or Playwright evidence; when Playwright applies, the `e2e` gate ran or is `BLOCKED` with cause.
- [ ] The PR is left for review and was not merged by the agent that prepared it.
