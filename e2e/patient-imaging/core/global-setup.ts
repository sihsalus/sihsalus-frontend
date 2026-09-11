/** This legacy suite must not mutate a shared PACS without owned synthetic fixtures. */
export default async function globalSetup() {
  throw new Error(
    'IMAGING_E2E_QUARANTINED: replace the legacy fixtures with a target-bound cleanup journal and synthetic DICOM ownership checks before running this suite.',
  );
}
