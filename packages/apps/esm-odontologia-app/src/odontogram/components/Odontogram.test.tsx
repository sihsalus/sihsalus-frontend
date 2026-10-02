import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { adultConfig } from '../config/adultConfig';
import { childConfig } from '../config/childConfig';
import { getOdontogramConfig } from '../config/dentition';
import { createEmptyOdontogramData, type OdontogramData } from '../types/odontogram';
import Odontogram from './Odontogram';

function Editor({
  initialData = createEmptyOdontogramData(adultConfig),
  allowDentitionChange = true,
  readOnly = false,
}) {
  const [data, setData] = useState<OdontogramData>(initialData);
  return (
    <>
      <Odontogram
        config={getOdontogramConfig(data)}
        data={data}
        onChange={setData}
        allowDentitionChange={allowDentitionChange}
        readOnly={readOnly}
      />
      <output data-testid="snapshot">{JSON.stringify(data)}</output>
    </>
  );
}

describe('odontogram dentition selection', () => {
  it('renders only the selected teeth and scales each arch to its natural width', async () => {
    const user = userEvent.setup();
    const { container } = render(<Editor />);
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(container.querySelector('foreignObject')).toHaveAttribute('width', '1260');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Dentition' }), 'child');
    expect(screen.queryByText('18')).not.toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(container.querySelector('foreignObject')).toHaveAttribute('width', '780');
    const saved = JSON.parse(screen.getByTestId('snapshot').textContent ?? '');
    expect(saved.dentition).toBe('child');
    expect(saved.teeth).toHaveLength(20);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Dentition' }), 'adult');
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.queryByText('55')).not.toBeInTheDocument();
  });

  it('preserves clinical entries and blocks changing the variant', async () => {
    const data = createEmptyOdontogramData(childConfig);
    data.especificaciones = 'Synthetic specification';
    render(<Editor initialData={data} />);
    expect(screen.getByRole('combobox', { name: 'Dentition' })).toBeDisabled();
    expect(JSON.parse(screen.getByTestId('snapshot').textContent ?? '')).toEqual(data);
  });

  it.each([
    { readOnly: true, allowDentitionChange: true },
    { readOnly: false, allowDentitionChange: false },
  ])('shows the saved variant without a selector for %j', (props) => {
    render(<Editor initialData={createEmptyOdontogramData(childConfig)} {...props} />);
    expect(screen.queryByRole('combobox', { name: 'Dentition' })).not.toBeInTheDocument();
    expect(screen.getByText('Primary dentition (20 teeth)')).toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
  });
});
