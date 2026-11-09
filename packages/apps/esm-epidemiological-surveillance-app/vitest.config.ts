import { defineAppVitestConfig } from '../../tooling/configs/vitest-config';

// Carbon emits informational notices (feature flags not yet enabled and the
// deprecation of `parseDate`, which DateInput needs for d/m/Y input). They do
// not describe test failures, so they are kept out of the test output.
const carbonNotices = [
  "[@carbon/feature-flags]",
  "The `parseDate` prop is deprecated",
];

export default defineAppVitestConfig(__dirname, {
  test: {
    onConsoleLog: (log: string) =>
      carbonNotices.some((notice) => log.includes(notice)) ? false : undefined,
  },
});
