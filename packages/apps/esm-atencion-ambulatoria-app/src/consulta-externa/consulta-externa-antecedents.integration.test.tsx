import {
  ExtensionSlot,
  getDefaultsFromConfigSchema,
  UserHasAccess,
  useAssignedExtensions,
  useConfig,
  useLayoutType,
  usePatient,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { launchPatientWorkspace, useClinicalEncounter } from '@openmrs/esm-patient-common-lib';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren, ReactNode } from 'react';
import ConditionsDetailedSummary from '../../../esm-patient-conditions-app/src/conditions/conditions-detailed-summary.component';
import { useConditions } from '../../../esm-patient-conditions-app/src/conditions/conditions.resource';
import { configSchema } from '../config-schema';
import type { OpenmrsEncounter } from '../types';
import ConsultaExternaAntecedents from './consulta-externa-antecedents.component';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  launchPatientWorkspace: vi.fn(),
  useClinicalEncounter: vi.fn(),
}));

vi.mock('../../../esm-patient-conditions-app/src/conditions/conditions.resource', async () => ({
  ...(await vi.importActual('../../../esm-patient-conditions-app/src/conditions/conditions.resource')),
  useConditions: vi.fn(),
}));

const syntheticPatient: fhir.Patient = {
  resourceType: 'Patient',
  id: 'synthetic-patient',
};
const conditionsReadPrivilege = 'app:hoja.clinica.condiciones';
const conditionsEditPrivilege = 'app:hoja.clinica.condiciones.editar';
const grantedPrivileges = new Set<string>();

describe('Consulta Externa integration with Antecedents and problems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grantedPrivileges.clear();
    [
      conditionsReadPrivilege,
      conditionsEditPrivilege,
      'app:hoja.clinica.historiaSocial',
      'app:hoja.clinica.historiaSocial.editar',
      'app:hoja.clinica.consultaExterna',
      'app:hoja.clinica.consultaExterna.editar',
    ].forEach((privilege) => {
      grantedPrivileges.add(privilege);
    });
    vi.mocked(userHasAccess).mockImplementation((privilege) =>
      (Array.isArray(privilege) ? privilege : [privilege]).every((required) => grantedPrivileges.has(required)),
    );
    vi.mocked(UserHasAccess).mockImplementation(
      ({
        privilege,
        children,
        fallback,
      }: PropsWithChildren<{
        privilege: string | string[];
        fallback?: ReactNode;
      }>) => (userHasAccess(privilege) ? children : fallback),
    );
    vi.mocked(useConfig).mockReturnValue(getDefaultsFromConfigSchema(configSchema));
    vi.mocked(useLayoutType).mockReturnValue('small-desktop');
    vi.mocked(useAssignedExtensions).mockReturnValue([
      {
        id: 'conditions-details-widget',
        name: 'conditions-details-widget',
        moduleName: '@sihsalus/esm-patient-conditions-app',
        meta: {},
        config: null,
      },
    ]);
    vi.mocked(usePatient).mockReturnValue({
      patient: syntheticPatient,
      patientUuid: syntheticPatient.id,
      isLoading: false,
      error: null,
    });
    vi.mocked(useSession).mockReturnValue({
      authenticated: true,
      user: { uuid: 'synthetic-clinician', display: 'Synthetic clinician' },
    } as ReturnType<typeof useSession>);
    vi.mocked(ExtensionSlot).mockImplementation(({ name, state }) =>
      name === 'consulta-externa-antecedents-slot' ? (
        <ConditionsDetailedSummary patient={state.patient as fhir.Patient} />
      ) : null,
    );
    vi.mocked(useConditions).mockReturnValue({
      conditions: [
        {
          id: 'synthetic-active-problem',
          conceptId: 'synthetic-active-concept',
          display: 'Synthetic active problem',
          clinicalStatus: 'Active',
          antecedentType: 'pathological',
          recordedDate: '2026-09-01T12:00:00.000Z',
        },
        {
          id: 'synthetic-past-diagnosis',
          conceptId: 'synthetic-past-concept',
          display: 'Synthetic past diagnosis',
          clinicalStatus: 'Inactive',
          antecedentType: 'definitive-diagnosis',
          recordedDate: '2026-09-01T12:00:00.000Z',
        },
        {
          id: 'synthetic-antecedent',
          conceptId: 'synthetic-antecedent-concept',
          display: 'Synthetic family antecedent',
          clinicalStatus: 'Inactive',
          antecedentType: 'family',
          recordedDate: '2026-09-01T12:00:00.000Z',
        },
      ],
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });
    vi.mocked(useClinicalEncounter).mockReturnValue({
      encounters: [
        {
          uuid: 'synthetic-historical-encounter',
          encounterDatetime: '2026-08-01T12:00:00.000Z',
          obs: [],
          diagnoses: [
            {
              diagnosis: {
                coded: { display: 'Synthetic historical encounter diagnosis' },
              },
            },
          ],
        } as unknown as OpenmrsEncounter,
      ],
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });
  });

  it('reads the canonical records beside encounter history and opens the same antecedent workspace', async () => {
    const user = userEvent.setup();
    render(<ConsultaExternaAntecedents patientUuid={syntheticPatient.id} />);

    expect(screen.getByRole('row', { name: /Synthetic active problem/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Synthetic past diagnosis/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Synthetic family antecedent/ })).toBeInTheDocument();
    expect(
      screen.getByRole('row', {
        name: /Synthetic historical encounter diagnosis/,
      }),
    ).toBeInTheDocument();
    expect(vi.mocked(useConditions)).toHaveBeenCalledWith(syntheticPatient.id);
    expect(screen.getAllByRole('button', { name: /^Add\b/ })).toHaveLength(3);

    const antecedentsHeader = screen.getByRole('heading', {
      name: 'Antecedents',
      exact: true,
    }).parentElement;
    await user.click(within(antecedentsHeader).getByRole('button', { name: /^Add\b/ }));

    expect(launchPatientWorkspace).toHaveBeenCalledExactlyOnceWith('conditions-form-workspace', {
      formContext: 'creating',
      workspaceTitle: 'Record antecedent',
    });
  });

  it('keeps both histories readable without offering edits when conditions editing is denied', () => {
    grantedPrivileges.delete(conditionsEditPrivilege);
    render(<ConsultaExternaAntecedents patientUuid={syntheticPatient.id} />);

    expect(screen.getByRole('row', { name: /Synthetic family antecedent/ })).toBeInTheDocument();
    expect(
      screen.getByRole('row', {
        name: /Synthetic historical encounter diagnosis/,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add\b/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Options' })).not.toBeInTheDocument();
    expect(launchPatientWorkspace).not.toHaveBeenCalled();
  });
});
