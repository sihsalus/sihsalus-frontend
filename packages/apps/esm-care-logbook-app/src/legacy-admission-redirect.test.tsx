import { render, waitFor } from '@testing-library/react';

import LegacyAdmissionRedirect from './legacy-admission-redirect.component';

describe('LegacyAdmissionRedirect', () => {
  let replaceStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.getOpenmrsSpaBase = vi.fn(() => '/openmrs/spa/');
    replaceStateSpy = vi.spyOn(window.history, 'replaceState');
  });

  afterEach(() => {
    replaceStateSpy.mockRestore();
  });

  it('redirects the legacy root to the canonical care logbook home', async () => {
    window.history.pushState({}, 'Legacy care logbook', '/openmrs/spa/admission');

    render(<LegacyAdmissionRedirect />);

    await waitFor(() =>
      expect(replaceStateSpy).toHaveBeenCalledWith(window.history.state, '', '/openmrs/spa/home/care-logbook'),
    );
  });

  it('redirects the former Home dashboard route to the canonical care logbook home', async () => {
    window.history.pushState({}, 'Former Home dashboard', '/openmrs/spa/home/admission');

    render(<LegacyAdmissionRedirect />);

    await waitFor(() =>
      expect(replaceStateSpy).toHaveBeenCalledWith(window.history.state, '', '/openmrs/spa/home/care-logbook'),
    );
  });

  it('redirects the legacy merge route to the canonical care logbook route', async () => {
    window.history.pushState({}, 'Legacy merge', '/openmrs/spa/admission/merge');

    render(<LegacyAdmissionRedirect />);

    await waitFor(() =>
      expect(replaceStateSpy).toHaveBeenCalledWith(window.history.state, '', '/openmrs/spa/home/care-logbook/merge'),
    );
  });

  it('preserves the patient suffix, query string, and hash while redirecting', async () => {
    window.history.pushState(
      {},
      'Legacy patient detail',
      '/openmrs/spa/admission/patient/patient-uuid?source=legacy#encounters',
    );

    render(<LegacyAdmissionRedirect />);

    await waitFor(() =>
      expect(replaceStateSpy).toHaveBeenCalledWith(
        window.history.state,
        '',
        '/openmrs/spa/home/care-logbook/patient/patient-uuid?source=legacy#encounters',
      ),
    );
  });
});
