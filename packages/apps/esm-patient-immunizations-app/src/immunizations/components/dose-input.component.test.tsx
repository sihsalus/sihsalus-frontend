import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useController, useForm } from 'react-hook-form';
import { DoseInput } from './dose-input.component';

function TestDoseInput({ initialDose }: { initialDose?: number }) {
  const { control } = useForm<{ doseNumber?: number | null }>({ defaultValues: { doseNumber: initialDose } });
  const { field, fieldState } = useController({ name: 'doseNumber', control });
  return <DoseInput field={field} fieldState={fieldState} vaccine="bcg-vaccine-uuid" sequences={[]} />;
}

describe('DoseInput', () => {
  it.each([undefined, 1, 2])('allows clearing and replacing dose %s without retaining digits', async (initialDose) => {
    const user = userEvent.setup();
    render(<TestDoseInput initialDose={initialDose} />);
    const input = screen.getByRole('spinbutton', { name: /dose number within series/i });

    await user.clear(input);
    expect(input).toHaveValue(null);
    await user.type(input, '3');
    expect(input).toHaveValue(3);
    await user.clear(input);
    expect(input).toHaveValue(null);
  });

  it('prevents scientific notation, signs, decimals, and symbols for manual dose numbers', () => {
    render(<TestDoseInput />);

    const input = screen.getByRole('spinbutton', { name: /dose number within series/i });
    for (const key of ['e', 'E', '+', '-', '.', ',']) {
      expect(fireEvent.keyDown(input, { key })).toBe(false);
    }
    expect(
      fireEvent.paste(input, {
        clipboardData: { getData: () => '1e2' },
      }),
    ).toBe(false);
  });
});
