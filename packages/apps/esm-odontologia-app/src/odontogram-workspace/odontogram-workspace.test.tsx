import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useOdontogramEncounter } from '../hooks/useOdontogramEncounter';
import { adultConfig } from '../odontogram/config/adultConfig';
import { childConfig } from '../odontogram/config/childConfig';
import { createEmptyOdontogramData } from '../odontogram/types/odontogram';
import useOdontogramDataStore from '../store/odontogramDataStore';
import OdontogramWorkspace from './odontogram-workspace.component';

vi.mock('../hooks/useOdontogramEncounter');
const save = vi.fn().mockResolvedValue({ uuid: 'saved-encounter' });
const props = {
  patientUuid: 'synthetic-patient',
  closeWorkspace: vi.fn(),
  closeWorkspaceWithSavedChanges: vi.fn(),
  promptBeforeClosing: vi.fn(),
  setTitle: vi.fn(),
};

beforeEach(() => {
  vi.mocked(useOdontogramEncounter).mockReturnValue({ save, error: null, isSaving: false });
  useOdontogramDataStore.setState({ currentPatientUuid: null, data: createEmptyOdontogramData(adultConfig) });
  useOdontogramDataStore.getState().resetFormSelection();
});

it('edits the primary encounter without offering a dentition change or creating another record', async () => {
  const user = userEvent.setup();
  const initialData = createEmptyOdontogramData(childConfig);
  initialData.observaciones = 'Synthetic note';
  render(<OdontogramWorkspace {...props} encounterUuid="existing-primary" initialData={initialData} />);
  expect(screen.getByText('55')).toBeInTheDocument();
  expect(screen.queryByRole('combobox', { name: 'Dentition' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ encounterUuid: 'existing-primary', data: initialData }));
});

it('reads historical permanent data without replacing a parked primary draft', () => {
  const draft = createEmptyOdontogramData(childConfig);
  draft.observaciones = 'Unsaved synthetic note';
  useOdontogramDataStore.setState({ currentPatientUuid: 'synthetic-patient', data: draft });
  const { dentition: _, ...legacy } = createEmptyOdontogramData(adultConfig);
  render(<OdontogramWorkspace {...props} readOnly initialData={legacy} />);
  expect(screen.getByText('18')).toBeInTheDocument();
  expect(screen.queryByText('55')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
  expect(useOdontogramDataStore.getState().data).toEqual(draft);
  expect(save).not.toHaveBeenCalled();
});
