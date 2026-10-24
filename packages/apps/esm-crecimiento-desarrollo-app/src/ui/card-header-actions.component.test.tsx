import { render, screen } from '@testing-library/react';

import { CardHeaderActions } from './card-header-actions.component';

it('keeps the action width reserved without exposing a write control in read-only mode', () => {
  const { container, rerender } = render(
    <CardHeaderActions status={<span>Registrado</span>} action={<button type="button">Editar</button>} showAction />,
  );

  expect(screen.getByRole('button', { name: 'Editar' })).toBeVisible();

  rerender(
    <CardHeaderActions
      status={<span>Registrado</span>}
      action={<button type="button">Editar</button>}
      showAction={false}
    />,
  );

  expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  expect(container.querySelector('button')).toBeInTheDocument();
  expect(container.querySelector('[aria-hidden="true"]')).not.toBeEmptyDOMElement();
});
