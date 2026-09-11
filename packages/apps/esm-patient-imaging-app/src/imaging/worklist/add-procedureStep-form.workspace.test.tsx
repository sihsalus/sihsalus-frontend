import { showSnackbar } from '@openmrs/esm-framework';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as api from '../../api';
import AddNewProcedureStepWorkspace, {
  type AddNewProcedureStepWorkspaceProps,
} from './add-procedureStep-form.workspace';

type DatePickerProps = {
  id: string;
  value?: Date;
  onChange: (date?: Date) => void;
  labelText: string;
  maxDate?: Date;
  invalidText?: string;
};

vi.mock('../../api');
vi.mock('@openmrs/esm-framework', async () => {
  const { forwardRef } = await import('react');
  return {
    ...(await vi.importActual('@openmrs/esm-framework')),
    OpenmrsDatePicker: forwardRef<HTMLInputElement, DatePickerProps>(
      ({ id, onChange, labelText, maxDate, invalidText }, ref) => (
        <label>
          {labelText}
          <input
            ref={ref}
            data-testid={id}
            type="date"
            max={maxDate?.toISOString().slice(0, 10)}
            aria-description={invalidText}
            onChange={(event) => {
              const [year, month, day] = event.target.value.split('-').map(Number);
              onChange(event.target.value ? new Date(year, month - 1, day) : undefined);
            }}
          />
        </label>
      ),
    ),
    useLayoutType: () => 'desktop',
    ResponsiveWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    showSnackbar: vi.fn(),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const defaultProps: AddNewProcedureStepWorkspaceProps = {
  patientUuid: 'synthetic-patient',
  request: {
    id: 31,
    patientUuid: 'synthetic-patient',
    status: 'scheduled',
    orthancConfiguration: { id: 4, orthancBaseUrl: 'http://orthanc:8042' },
    accessionNumber: 'SYNTHETIC-31',
    requestingPhysician: 'Synthetic clinician',
    requestDescription: 'Synthetic request',
    priority: 'high',
  },
  closeWorkspace: vi.fn(),
  closeWorkspaceWithSavedChanges: vi.fn(),
  promptBeforeClosing: vi.fn(),
  setTitle: vi.fn(),
};

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText('AetTitle'), { target: { value: 'SYNTHETIC_AE' } });
  fireEvent.change(screen.getByLabelText('scheduledReferringPhysician'), { target: { value: 'Synthetic clinician' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Synthetic procedure' } });
  fireEvent.change(screen.getByTestId('stepStartDate'), { target: { value: '2030-09-04' } });
  fireEvent.change(screen.getByTestId('stepStartTime'), { target: { value: '12:30' } });
  fireEvent.change(screen.getByLabelText('Time Format'), { target: { value: 'PM' } });
}

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save and Close' }));

describe('AddNewProcedureStepWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.saveRequestProcedureStep).mockReset();
    vi.mocked(api.saveRequestProcedureStep).mockResolvedValue({} as never);
    vi.mocked(api.useProcedureStep).mockReturnValue({ mutate: vi.fn() } as never);
    vi.mocked(api.useRequestsByPatient).mockReturnValue({ mutate: vi.fn() } as never);
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('allows a future date and sends separate DICOM DA8 and TM6 values', async () => {
    render(<AddNewProcedureStepWorkspace {...defaultProps} />);
    expect(screen.getByTestId('stepStartDate')).not.toHaveAttribute('max');
    fillRequiredFields();
    save();
    await waitFor(() =>
      expect(api.saveRequestProcedureStep).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 31, modality: 'CR', stepStartDate: '20300904', stepStartTime: '123000' }),
        31,
        expect.any(AbortController),
      ),
    );
    expect(defaultProps.closeWorkspaceWithSavedChanges).toHaveBeenCalledTimes(1);
  });

  it('selects nuclear medicine using NM without changing PET', async () => {
    render(<AddNewProcedureStepWorkspace {...defaultProps} />);
    fillRequiredFields();
    const modality = screen.getByRole('combobox', { name: 'Modality' });
    fireEvent.change(modality, { target: { value: 'NM' } });
    fireEvent.keyDown(modality, { key: 'ArrowDown' });
    fireEvent.keyDown(modality, { key: 'Enter' });
    save();
    await waitFor(() =>
      expect(api.saveRequestProcedureStep).toHaveBeenCalledWith(
        expect.objectContaining({ modality: 'NM' }),
        31,
        expect.any(AbortController),
      ),
    );
  });

  it.each(['13:00', '12:60', '1:5', ''])('rejects an invalid time before saving: %s', async (time) => {
    render(<AddNewProcedureStepWorkspace {...defaultProps} />);
    fillRequiredFields();
    fireEvent.change(screen.getByTestId('stepStartTime'), { target: { value: time } });
    save();
    await screen.findByText('Enter a valid time from 01:00 to 12:59');
    expect(api.saveRequestProcedureStep).not.toHaveBeenCalled();
  });

  it.each(['AE-123456789012345', 'AE\\INVALID', 'AE-é'])('rejects an invalid DICOM AE value: %s', async (value) => {
    render(<AddNewProcedureStepWorkspace {...defaultProps} />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText('AetTitle'), { target: { value } });
    save();
    await waitFor(() => expect(screen.getByLabelText('AetTitle')).toHaveAttribute('data-invalid', 'true'));
    expect(api.saveRequestProcedureStep).not.toHaveBeenCalled();
  });

  it.each([
    ['scheduledReferringPhysician', 65],
    ['Description', 65],
    ['stationName', 17],
    ['procedureStepLocation', 17],
  ] as const)('rejects a value exceeding DICOM length for %s', async (label, length) => {
    render(<AddNewProcedureStepWorkspace {...defaultProps} />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(label), { target: { value: 'X'.repeat(length) } });
    save();
    await screen.findByText(/Use at most/);
    expect(api.saveRequestProcedureStep).not.toHaveBeenCalled();
  });

  it('rejects a request belonging to a different patient', async () => {
    render(<AddNewProcedureStepWorkspace {...defaultProps} patientUuid="another-synthetic-patient" />);
    fillRequiredFields();
    save();
    await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
    expect(api.saveRequestProcedureStep).not.toHaveBeenCalled();
  });

  it('releases the save control after an error and reports a safe message', async () => {
    vi.mocked(api.saveRequestProcedureStep).mockRejectedValueOnce(new Error('private backend details'));
    render(<AddNewProcedureStepWorkspace {...defaultProps} />);
    fillRequiredFields();
    save();
    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle: 'The operation could not be completed. Refresh and check the result before trying again.',
        }),
      ),
    );
    expect(screen.getByRole('button', { name: 'Save and Close' })).toBeEnabled();
    expect(defaultProps.closeWorkspaceWithSavedChanges).not.toHaveBeenCalled();
  });

  it('prevents duplicate submission and ignores completion after unmount', async () => {
    let resolveSave: (value: never) => void;
    vi.mocked(api.saveRequestProcedureStep).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        }),
    );
    const { unmount } = render(<AddNewProcedureStepWorkspace {...defaultProps} />);
    fillRequiredFields();
    const form = screen.getByRole('button', { name: 'Save and Close' }).closest('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(api.saveRequestProcedureStep).toHaveBeenCalledTimes(1));
    const controller = vi.mocked(api.saveRequestProcedureStep).mock.calls[0][2];
    unmount();
    expect(controller.signal.aborted).toBe(true);
    await act(async () => resolveSave({} as never));
    expect(defaultProps.closeWorkspaceWithSavedChanges).not.toHaveBeenCalled();
    expect(showSnackbar).not.toHaveBeenCalled();
  });
});

vi.mock('../utils/use-imaging-access', () => ({ useImagingAccess: vi.fn(() => ({ canWrite: true, isOnline: true })) }));
