import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fuaReadPrivilege } from './constant';
import FuaEncounterAction from './fua-encounter-action.component';

type RequirePrivilegeProps = {
  privilege: string | string[];
  hideUnauthorized?: boolean;
  children?: ReactNode;
};

const mockRequirePrivilege = vi.hoisted(() => vi.fn((_props: RequirePrivilegeProps): ReactNode => null));
const mockActionMenuButton2 = vi.hoisted(() =>
  vi.fn(({ label }: { label: ReactNode; workspaceToLaunch: unknown }) => <button type="button">{label}</button>),
);
const mockUsePatientChartStore = vi.hoisted(() =>
  vi.fn(() => ({
    patientUuid: 'store-patient-uuid',
    patient: null,
    visitContext: null,
    mutateVisitContext: vi.fn(),
  })),
);

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: (props: RequirePrivilegeProps) => mockRequirePrivilege(props),
}));

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  ActionMenuButton2: mockActionMenuButton2,
}));

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  usePatientChartStore: mockUsePatientChartStore,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

describe('FuaEncounterAction', () => {
  beforeEach(() => {
    mockActionMenuButton2.mockClear();
    mockUsePatientChartStore.mockClear();
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
  });

  const visitContext = {
    uuid: 'visit-uuid',
    visitType: null,
    startDatetime: '2026-06-16T10:00:00.000-05:00',
    stopDatetime: null,
  };
  const patient = { id: 'patient-uuid' } as fhir.Patient;

  it('protects patient FUA viewing with the read privilege', () => {
    render(
      <FuaEncounterAction
        groupProps={{
          patientUuid: 'patient-uuid',
          patient,
          visitContext,
          mutateVisitContext: vi.fn(),
        }}
      />,
    );

    expect(mockRequirePrivilege).toHaveBeenCalledWith(
      expect.objectContaining({
        privilege: fuaReadPrivilege,
        hideUnauthorized: true,
        children: expect.anything(),
      }),
    );
    expect(screen.getByRole('button', { name: /ver fuas del paciente/i })).toBeInTheDocument();
    expect(mockActionMenuButton2).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Ver FUAs del paciente',
        workspaceToLaunch: expect.objectContaining({
          workspaceName: 'patient-fuas-workspace',
          workspaceProps: { patientUuid: 'patient-uuid' },
          groupProps: expect.objectContaining({ patientUuid: 'patient-uuid' }),
        }),
      }),
      {},
    );
  });

  it('hides the patient FUA action when access is denied', () => {
    mockRequirePrivilege.mockImplementation(() => null);

    render(
      <FuaEncounterAction
        groupProps={{
          patientUuid: 'patient-uuid',
          patient,
          visitContext,
          mutateVisitContext: vi.fn(),
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: /ver fuas del paciente/i })).not.toBeInTheDocument();
    expect(mockUsePatientChartStore).not.toHaveBeenCalled();
  });
});
