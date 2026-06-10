import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';

import type { NewbornVitalsFormType } from '../../common/data.resource';

import NewbornVitalsInput from './newborn-vitals-input.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  ResponsiveWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLayoutType: () => 'desktop',
}));

function TestNewbornVitalsInput() {
  const { control } = useForm<NewbornVitalsFormType>();

  return (
    <NewbornVitalsInput
      control={control}
      label="Número de deposiciones"
      fieldProperties={[
        {
          id: 'stoolCount',
          name: 'Número de deposiciones',
          type: 'number',
          min: 0,
          max: 20,
          invalidText: 'Número de deposiciones debe estar entre 0 y 20',
        },
      ]}
      showInlineValidation
    />
  );
}

describe('NewbornVitalsInput', () => {
  it('shows the range validation message as soon as a numeric value is out of range', () => {
    render(<TestNewbornVitalsInput />);

    fireEvent.change(screen.getByTitle('Número de deposiciones'), { target: { value: '21' } });

    expect(screen.getByText('Número de deposiciones debe estar entre 0 y 20')).toBeInTheDocument();
  });
});
