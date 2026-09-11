# Patient imaging E2E — quarantined

This legacy suite is blocked in `core/global-setup.ts` before authentication or
fixture creation. It is not clinical evidence and must not run against a shared
DEV, QLTY or production PACS. The block has no environment-variable bypass.

`studiesbyconfig` returns candidate studies for an entire Orthanc configuration;
the `patient` argument affects matching scores, not ownership. The previous
`cleanOrthanc` implementation incorrectly deleted these candidates. It now fails
before making any request. The helper that swallowed patient-study cleanup
failures and the spec that deleted unrelated studies have been removed.

Before replacing this block, implement and review all of the following:

- An explicitly authorized DEV/QLTY target, frontend SHA, active test session,
  required privileges and exact Orthanc configuration preflight.
- A fresh synthetic patient and generated DICOM with unique Study/Series/SOP UIDs,
  explicit synthetic demographics and a patient identity matching the fixture.
- A private, target-bound journal written before and after each mutation. Preserve
  ambiguous uploads for reconciliation and unresolved cleanup state for recovery.
- Cleanup by exact journaled identity, checked against both OpenMRS and Orthanc.
  Never treat candidate lists, matching scores or the first configuration as
  ownership. Do not retry or delete an uncertain resource blindly.
- Real UI upload, association, reload, authenticated preview and OHIF pixel loading;
  allow/deny roles, interrupted operations, and error states.
- DICOM worklist C-FIND with DA8/TM6 values and a separately authorized callback
  test. Configure all fixture metadata instead of using legacy UUID defaults.

The old ZIP fixture is absent from this repository; do not download a patient
study to replace it. ZIP upload is deliberately unavailable until a supported
backend contract can reconcile every instance and study.

`../utils/e2e-imaging-quarantine.test.ts` imports the real quarantine and retired
cleanup functions. It is discovered by the existing `yarn test:e2e:unit` command
(`vitest run e2e/utils --environment node`), included in `yarn test:e2e:contracts`
and the E2E workflow's `contracts` job on pull requests to `main`. That job does
not require the browser suite's `e2e` label. A guard test inside this suite's
`core` directory would fall outside that unit-test command.

These checks, and the rest of the changed imaging tests, have **NOT RUN** after
the user requested no local testing. No browser fixture is created by these
quarantine regression checks.
