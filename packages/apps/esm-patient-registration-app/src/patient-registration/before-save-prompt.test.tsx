import { navigate } from '@openmrs/esm-framework';
import { render, waitFor } from '@testing-library/react';
import BeforeSavePrompt from './before-save-prompt';

vi.mock('@openmrs/esm-framework', () => ({
  navigate: vi.fn(),
  showModal: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, defaultValue: string) => defaultValue }),
}));

vi.mock('../constants', () => ({ moduleName: 'test-module' }));

describe('BeforeSavePrompt', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to the validated redirect without rebuilding its SPA prefix', async () => {
    const redirect = '/openmrs/spa/forms/form/form-uuid?patientUuid=patient-uuid';

    render(<BeforeSavePrompt when={false} redirect={redirect} />);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: redirect }));
  });
});
