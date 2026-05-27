/**
 * This is the root test for this page. It simply checks that the page
 * renders. If the components of your page are highly interdependent,
 * (e.g., if the `Root` component had state that communicated
 * information between `Greeter` and `PatientGetter`) then you might
 * want to do most of your testing here. If those components are
 * instead quite independent (as is the case in this example), then
 * it would make more sense to test those components independently.
 *
 * The key thing to remember, always, is: write tests that behave like
 * users. They should *look* for elements by their visual
 * characteristics, *interact* with them, and (mostly) *assert* based
 * on things that would be visually apparent to a user.
 *
 * To learn more about how we do testing, see the following resources:
 *   https://o3-docs.vercel.app/docs/frontend-modules/testing
 *   https://kentcdodds.com/blog/how-to-know-what-to-test
 *   https://kentcdodds.com/blog/testing-implementation-details
 *   https://kentcdodds.com/blog/common-mistakes-with-react-testing-library
 *
 * Kent C. Dodds is the inventor of `@testing-library`:
 *   https://testing-library.com/docs/guiding-principles
 */

import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { type Config, configSchema } from './config-schema';
import Root from './root.component';

vi.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Routes: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Route: ({ element, children }: { element?: React.ReactNode; children?: React.ReactNode }) => element ?? children,
}));

/**
 * This is an idiomatic way of dealing with mocked files. Note that
 * `useConfig` is already mocked; the Jest moduleNameMapper (see the
 * Jest config) has mapped the `@openmrs/esm-framework` import to a
 * mock file. This line just tells TypeScript that the object is, in
 * fact, a mock, and so will have methods like `mockReturnValue`.
 */
const mockUseConfig = vi.mocked(useConfig<Config>);

it('renders the emergency dashboard', () => {
  const config: Config = {
    ...(getDefaultsFromConfigSchema(configSchema) as Config),
    priorityConfigs: [],
    concepts: {
      ...(getDefaultsFromConfigSchema(configSchema) as Config).concepts,
      emergencyConceptUuid: 'mocked-emergency-concept-uuid',
      urgencyConceptUuid: 'mocked-urgency-concept-uuid',
    },
  };
  mockUseConfig.mockReturnValue(config);

  render(<Root />);

  expect(screen.getByText(/emergency services/i)).toBeInTheDocument();
});
