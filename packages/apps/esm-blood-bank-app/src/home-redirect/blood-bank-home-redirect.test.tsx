import { navigate } from '@openmrs/esm-framework';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import routes from '../routes.json';
import BloodBankHomeRedirect from './blood-bank-home-redirect.extension';

describe('Blood Bank landing from the standard home route', () => {
  beforeEach(() => vi.mocked(navigate).mockClear());

  it('registers a Blood Bank dashboard gated only by the Blood Bank privilege', () => {
    expect(routes.extensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'blood-bank-home-dashboard-link',
          slot: 'homepage-dashboard-slot',
          privileges: 'app:home.bancoSangre',
          meta: expect.objectContaining({ name: 'blood-bank', slot: 'blood-bank-home-redirect-slot' }),
        }),
        expect.objectContaining({
          name: 'blood-bank-home-redirect',
          slot: 'blood-bank-home-redirect-slot',
          privileges: 'app:home.bancoSangre',
        }),
      ]),
    );
  });

  it('redirects the selected home dashboard to the Blood Bank application', () => {
    render(<BloodBankHomeRedirect />);

    expect(navigate).toHaveBeenCalledWith({ to: '/openmrs/spa/blood-bank' });
  });
});
