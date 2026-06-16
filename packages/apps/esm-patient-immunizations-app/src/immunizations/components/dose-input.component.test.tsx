import { fireEvent, render, screen } from '@testing-library/react';
import { type Control, useForm } from 'react-hook-form';
import { DoseInput } from './dose-input.component';

function TestDoseInput() {
  const { control } = useForm({ defaultValues: { doseNumber: undefined } });
  return <DoseInput control={control as unknown as Control} vaccine="bcg-vaccine-uuid" sequences={[]} />;
}

describe('DoseInput', () => {
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
