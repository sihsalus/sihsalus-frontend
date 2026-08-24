import { render, screen } from '@testing-library/react';

import FormLoadError from './form-load-error.component';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

describe('FormLoadError', () => {
  it('renders a safe error state without exposing backend details', () => {
    render(<FormLoadError />);

    expect(screen.getByRole('alert')).toHaveTextContent('The clinical form could not be loaded');
    expect(screen.getByRole('alert')).toHaveTextContent('This form cannot be opened or saved. Close it and try again.');
    expect(screen.getByRole('alert')).not.toHaveTextContent(/403|forbidden/i);
  });
});
