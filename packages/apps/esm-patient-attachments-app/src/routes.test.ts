import { isVersionSatisfied } from '@openmrs/esm-framework';

import routes from './routes.json';

const attachmentsRange = routes.backendDependencies.attachments;

describe('attachments backend contract', () => {
  // Only uploading a supplemental laboratory PDF needs the SIH Salus release,
  // and that path ships behind a runtime flag that defaults to false. Declaring
  // the fork as a hard requirement reported the whole module as incompatible on
  // every upstream deployment, which is a permanent false alarm.
  it('accepts a stock upstream Attachments 4.x backend', () => {
    expect(isVersionSatisfied(attachmentsRange, '4.0.0')).toBe(true);
  });

  it('accepts the SIH Salus release that supports laboratory PDF uploads', () => {
    expect(isVersionSatisfied(attachmentsRange, '4.0.1-sihsalus.1')).toBe(true);
  });

  it('still rejects the next major, whose contract is unverified', () => {
    expect(isVersionSatisfied(attachmentsRange, '5.0.0')).toBe(false);
  });
});
