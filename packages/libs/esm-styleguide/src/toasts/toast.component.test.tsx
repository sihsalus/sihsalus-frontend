import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Toast } from './toast.component';

describe('Toast', () => {
  it('renders short descriptions without a details action', () => {
    renderToast('The order was saved.');

    expect(screen.getByText('The order was saved.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show more/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Focus sentinel')).not.toBeInTheDocument();
  });

  it('truncates long descriptions and shows the complete content in a modal', () => {
    const description = Array.from({ length: 30 }, (_, index) => `Laboratory order ${index + 1}`).join(', ');
    renderToast(description);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText((content) => content.endsWith('…'))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show more/i }));

    const dialog = screen.getByRole('dialog', { name: 'Orders completed' });
    expect(dialog).toBeInTheDocument();
    expect(screen.queryByText('Focus sentinel')).not.toBeInTheDocument();
    // El modal parte a proposito una descripcion separada por comas en una
    // lista, asi que la cadena unida no existe como un solo nodo de texto.
    const items = within(dialog).getAllByRole('listitem');
    expect(items).toHaveLength(30);
    expect(items[0]).toHaveTextContent('Laboratory order 1');
    expect(items[29]).toHaveTextContent('Laboratory order 30');
  });

  it('preserves an existing toast action when details are available', () => {
    const onActionButtonClick = vi.fn();
    const closeToast = vi.fn();
    const description = 'A'.repeat(200);

    render(
      <Toast
        toast={{
          id: 1,
          title: 'Attention required',
          description,
          actionButtonLabel: 'Review',
          onActionButtonClick,
        }}
        closeToast={closeToast}
      />,
    );

    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));

    expect(onActionButtonClick).toHaveBeenCalledOnce();
    expect(closeToast).toHaveBeenCalledOnce();
  });
});

function renderToast(description: string) {
  return render(
    <Toast
      toast={{
        id: 1,
        title: 'Orders completed',
        description,
      }}
      closeToast={vi.fn()}
    />,
  );
}
