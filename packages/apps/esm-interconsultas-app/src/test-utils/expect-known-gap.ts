/**
 * Keeps an acceptance gap executable without making the test suite red.
 * Once the callback stops failing, this helper fails the test so the scenario
 * must be converted into a regular passing assertion.
 */
export async function expectKnownGap(assertion: () => unknown | Promise<unknown>) {
  try {
    await assertion();
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AssertionError' ||
        Object.hasOwn(error, 'matcherResult') ||
        /(?:expected|expect\()/i.test(error.message))
    ) {
      return;
    }
    throw error;
  }

  throw new Error('Known acceptance gap now passes. Convert this scenario into a regular test.');
}
