import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';

import { getAutomaticNationalityUpdate } from '../patient-nationality';
import { EmergencyNationalityField } from './emergency-nationality-field.component';

const peruConceptUuid = 'e0370dea-d480-4721-a438-97a77d6c3349';
const colombiaConceptUuid = 'b4c6023d-4e90-4803-a0cf-b089994a9ba1';
const options = [
  { uuid: peruConceptUuid, display: 'Perú' },
  { uuid: colombiaConceptUuid, display: 'Colombia' },
];

function AutomaticNationalityHarness({ onFormChange }: { onFormChange: (value: string) => void }) {
  const [value, setValue] = useState('');
  const nationalityWasAutoAssigned = useRef(false);

  const applyAutomaticUpdate = (hasCompletedDni: boolean) => {
    const update = getAutomaticNationalityUpdate({
      currentNationality: value,
      hasCompletedDni,
      isUnknown: false,
      peruConceptUuid,
      wasAutoAssigned: nationalityWasAutoAssigned.current,
    });
    nationalityWasAutoAssigned.current = update.wasAutoAssigned;
    if (update.shouldUpdate) {
      setValue(update.nationality);
    }
  };

  return (
    <>
      <button type="button" onClick={() => applyAutomaticUpdate(true)}>
        Complete DNI
      </button>
      <button type="button" onClick={() => applyAutomaticUpdate(false)}>
        Invalidate DNI
      </button>
      <output aria-label="assignment source">{nationalityWasAutoAssigned.current ? 'automatic' : 'manual'}</output>
      <EmergencyNationalityField
        value={value}
        options={options}
        isLoading={false}
        nationalityWasAutoAssigned={nationalityWasAutoAssigned}
        onChange={(conceptUuid) => {
          onFormChange(conceptUuid);
          setValue(conceptUuid);
        }}
      />
    </>
  );
}

describe('EmergencyNationalityField', () => {
  it('ignores Carbon echoing an automatic Peru value and later clears it with an incomplete DNI', async () => {
    const user = userEvent.setup();
    const onFormChange = vi.fn();
    render(<AutomaticNationalityHarness onFormChange={onFormChange} />);

    await user.click(screen.getByRole('button', { name: 'Complete DNI' }));

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Nacionalidad' })).toHaveValue('Perú'));
    expect(screen.getByRole('status', { name: 'assignment source' })).toHaveTextContent('automatic');
    expect(onFormChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Invalidate DNI' }));

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Nacionalidad' })).toHaveValue(''));
    expect(screen.getByRole('status', { name: 'assignment source' })).toHaveTextContent('manual');
    expect(onFormChange).not.toHaveBeenCalled();
  });

  it('accepts a manual nationality after the DNI becomes incomplete', async () => {
    const user = userEvent.setup();
    const onFormChange = vi.fn();
    render(<AutomaticNationalityHarness onFormChange={onFormChange} />);

    await user.click(screen.getByRole('button', { name: 'Complete DNI' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Nacionalidad' })).toHaveValue('Perú'));
    await user.click(screen.getByRole('button', { name: 'Invalidate DNI' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Nacionalidad' })).toHaveValue(''));

    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(await screen.findByText('Colombia'));

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Nacionalidad' })).toHaveValue('Colombia'));
    expect(screen.getByRole('status', { name: 'assignment source' })).toHaveTextContent('manual');
    expect(onFormChange).toHaveBeenCalledTimes(1);
    expect(onFormChange).toHaveBeenLastCalledWith(colombiaConceptUuid);
  });
});
