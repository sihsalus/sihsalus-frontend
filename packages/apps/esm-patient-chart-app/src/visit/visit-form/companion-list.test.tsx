import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithSwr } from 'test-utils';
import CompanionList from './companion-list.component';

describe('CompanionList', () => {
  it('starts without inheriting a permanent patient companion', () => {
    renderWithSwr(<CompanionList isLoading={false} onClearCompanion={vi.fn()} required={false} />);

    expect(screen.getByText(/No (companion has been selected|se ha seleccionado un acompañante)/i)).toBeInTheDocument();
  });

  it('shows and clears only the companion selected for this consultation', async () => {
    const user = userEvent.setup();
    const onClearCompanion = vi.fn();
    renderWithSwr(
      <CompanionList
        isLoading={false}
        onClearCompanion={onClearCompanion}
        selectedCompanion={{ personUuid: 'person-uuid', name: 'María Pérez' }}
      />,
    );

    expect(screen.getByText('María Pérez')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Remove|Quitar/i }));
    expect(onClearCompanion).toHaveBeenCalledOnce();
  });
});
