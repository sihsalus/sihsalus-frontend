import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NationalityConceptField } from './nationality-concept-field.component';

const peruConceptUuid = 'e0370dea-d480-4721-a438-97a77d6c3349';
const colombiaConceptUuid = 'b4c6023d-4e90-4803-a0cf-b089994a9ba1';
const options = [
  { uuid: peruConceptUuid, display: 'Perú' },
  { uuid: colombiaConceptUuid, display: 'Colombia' },
];

describe('NationalityConceptField', () => {
  it('emits the selected concept UUID rather than a country code', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NationalityConceptField isLoading={false} options={options} value="" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(await screen.findByText('Perú'));

    expect(onChange).toHaveBeenCalledWith(peruConceptUuid);
  });

  it('displays a nationality returned as an OpenMRS concept UUID', () => {
    render(
      <NationalityConceptField isLoading={false} options={options} value={colombiaConceptUuid} onChange={() => {}} />,
    );

    expect(screen.getByRole('combobox', { name: 'Nacionalidad' })).toHaveValue('Colombia');
  });

  it('reports loading, unavailable, and empty catalogs', () => {
    const { rerender } = render(<NationalityConceptField isLoading options={undefined} value="" onChange={() => {}} />);
    expect(screen.getByText('Cargando nacionalidades...')).toBeInTheDocument();

    rerender(<NationalityConceptField isLoading={false} error={new Error('Forbidden')} value="" onChange={() => {}} />);
    expect(screen.getByText('No se pudo cargar el catálogo de nacionalidades')).toBeInTheDocument();

    rerender(<NationalityConceptField isLoading={false} options={[]} value="" onChange={() => {}} />);
    expect(screen.getByText('El catálogo de nacionalidades está vacío')).toBeInTheDocument();
  });
});
