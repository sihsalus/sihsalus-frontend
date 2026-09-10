import {
  ExtensionSlot,
  getDefaultsFromConfigSchema,
  useAssignedExtensions,
  useConfig,
  usePatient,
} from '@openmrs/esm-framework';
import { useClinicalEncounter } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { type ConfigObject, configSchema } from '../config-schema';
import ConsultaExternaAntecedents from './consulta-externa-antecedents.component';

const grantedPrivileges = new Set<string>();
const patient: fhir.Patient = { resourceType: 'Patient', id: 'synthetic-patient-uuid' };
const conditionsPrivilege = 'app:hoja.clinica.condiciones';
const socialPrivilege = 'app:hoja.clinica.historiaSocial';
const slotName = 'consulta-externa-antecedents-slot';

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ children, privilege }: PropsWithChildren<{ privilege: string }>) =>
    grantedPrivileges.has(privilege) ? children : null,
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  useClinicalEncounter: vi.fn(),
}));

vi.mock('../clinical-encounter/summary/out-patient-summary/patient-medical-history.component', () => ({
  default: ({ patientUuid, readOnly }: { patientUuid: string; readOnly?: boolean }) => (
    <div data-patient-uuid={patientUuid} data-read-only={readOnly}>
      Previous medical records
    </div>
  ),
}));

vi.mock('../clinical-encounter/summary/out-patient-summary/patient-social-history.component', () => ({
  default: ({ patientUuid }: { patientUuid: string }) => <div data-patient-uuid={patientUuid}>Social history</div>,
}));

describe('ConsultaExternaAntecedents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grantedPrivileges.clear();
    grantedPrivileges.add(conditionsPrivilege);
    grantedPrivileges.add(socialPrivilege);
    vi.mocked(useConfig).mockReturnValue(getDefaultsFromConfigSchema(configSchema) as ConfigObject);
    vi.mocked(usePatient).mockReturnValue({ patient, patientUuid: patient.id, isLoading: false, error: null });
    vi.mocked(useAssignedExtensions).mockReturnValue([
      {
        id: 'conditions-details-widget',
        name: 'conditions-details-widget',
        moduleName: '@sihsalus/esm-patient-conditions-app',
        meta: {},
        config: null,
      },
    ]);
    vi.mocked(useClinicalEncounter).mockReturnValue({
      encounters: [],
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });
  });

  it('mounts canonical antecedents with the current patient and keeps previous records read-only', () => {
    render(<ConsultaExternaAntecedents patientUuid={patient.id} />);

    expect(ExtensionSlot).toHaveBeenCalledWith(
      expect.objectContaining({ name: slotName, state: { patient, patientUuid: patient.id } }),
      expect.anything(),
    );
    expect(screen.getByText('Previous medical records')).toHaveAttribute('data-read-only', 'true');
    expect(screen.getByText('Previous medical records')).toHaveAttribute('data-patient-uuid', patient.id);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Antecedents and problems',
      'Social History',
    ]);
  });

  it('opens canonical antecedents without requiring the unrelated social-history privilege', () => {
    grantedPrivileges.delete(socialPrivilege);
    render(<ConsultaExternaAntecedents patientUuid={patient.id} />);

    expect(ExtensionSlot).toHaveBeenCalled();
    expect(useClinicalEncounter).not.toHaveBeenCalled();
    expect(screen.queryByText('Previous medical records')).not.toBeInTheDocument();
  });

  it('preserves access to previous records and social history without granting access to conditions', async () => {
    grantedPrivileges.delete(conditionsPrivilege);
    const user = userEvent.setup();
    render(<ConsultaExternaAntecedents patientUuid={patient.id} />);

    expect(usePatient).not.toHaveBeenCalled();
    expect(ExtensionSlot).not.toHaveBeenCalled();
    expect(screen.getByText('Previous medical records')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Social History' }));
    expect(screen.getByText('Social history')).toHaveAttribute('data-patient-uuid', patient.id);
  });

  it('does not load either history when both read privileges are denied', () => {
    grantedPrivileges.clear();
    render(<ConsultaExternaAntecedents patientUuid={patient.id} />);

    expect(usePatient).not.toHaveBeenCalled();
    expect(useClinicalEncounter).not.toHaveBeenCalled();
    expect(ExtensionSlot).not.toHaveBeenCalled();
  });

  it('waits for the patient before mounting the extension', () => {
    vi.mocked(usePatient).mockReturnValue({ patient: null, patientUuid: patient.id, isLoading: true, error: null });
    render(<ConsultaExternaAntecedents patientUuid={patient.id} />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(ExtensionSlot).not.toHaveBeenCalled();
  });

  it.each([
    { patient: null, error: new Error('Private backend details') },
    { patient: null, error: null },
    { patient: { resourceType: 'Patient' as const, id: 'previous-patient' }, error: null },
  ])('does not mount with missing, failed or stale patient data: %j', (result) => {
    vi.mocked(usePatient).mockReturnValue({ ...result, patientUuid: patient.id, isLoading: false });
    render(<ConsultaExternaAntecedents patientUuid={patient.id} />);

    expect(ExtensionSlot).not.toHaveBeenCalled();
    expect(screen.getByText('Unable to load antecedents. Reload the page and try again.')).toBeInTheDocument();
    expect(screen.queryByText('Private backend details')).not.toBeInTheDocument();
  });

  it('updates the extension state when the patient changes', () => {
    const { rerender } = render(<ConsultaExternaAntecedents patientUuid={patient.id} />);
    const nextPatient: fhir.Patient = { resourceType: 'Patient', id: 'next-synthetic-patient' };
    vi.mocked(usePatient).mockReturnValue({
      patient: nextPatient,
      patientUuid: nextPatient.id,
      isLoading: false,
      error: null,
    });
    rerender(<ConsultaExternaAntecedents patientUuid={nextPatient.id} />);

    expect(ExtensionSlot).toHaveBeenLastCalledWith(
      expect.objectContaining({ state: { patient: nextPatient, patientUuid: nextPatient.id } }),
      expect.anything(),
    );
  });

  it('keeps the slot mounted and shows a safe message when no extension is available', () => {
    vi.mocked(useAssignedExtensions).mockReturnValue([]);
    render(<ConsultaExternaAntecedents patientUuid={patient.id} />);

    expect(ExtensionSlot).toHaveBeenCalled();
    expect(screen.getByText('Unable to load antecedents. Reload the page and try again.')).toBeInTheDocument();
  });
});
