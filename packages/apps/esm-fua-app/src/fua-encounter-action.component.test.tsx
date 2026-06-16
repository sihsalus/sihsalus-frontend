import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fuaManagePrivilege } from './constant';
import FuaEncounterAction from './fua-encounter-action.component';

type RequirePrivilegeProps = {
  privilege: string | string[];
  hideUnauthorized?: boolean;
  children?: ReactNode;
};

const mockRequirePrivilege = vi.hoisted(() => vi.fn((_props: RequirePrivilegeProps): ReactNode => null));
const mockUseStartVisitIfNeeded = vi.hoisted(() => vi.fn(() => vi.fn(async () => true)));
const mockUseVisitOrOfflineVisit = vi.hoisted(() =>
  vi.fn(() => ({
    currentVisit: { uuid: 'visit-uuid' },
    activeVisit: null,
    mutate: vi.fn(),
  })),
);

vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: (props: RequirePrivilegeProps) => mockRequirePrivilege(props),
}));

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
  showSnackbar: vi.fn(),
  useLayoutType: vi.fn(() => 'desktop'),
}));

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  useStartVisitIfNeeded: mockUseStartVisitIfNeeded,
  useVisitOrOfflineVisit: mockUseVisitOrOfflineVisit,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

describe('FuaEncounterAction', () => {
  beforeEach(() => {
    mockUseStartVisitIfNeeded.mockClear();
    mockUseVisitOrOfflineVisit.mockClear();
    mockRequirePrivilege.mockImplementation(({ children }) => <>{children}</>);
  });

  const visitContext = {
    uuid: 'visit-uuid',
    visitType: null,
    startDatetime: '2026-06-16T10:00:00.000-05:00',
    stopDatetime: null,
  };
  const patient = { id: 'patient-uuid' } as fhir.Patient;

  it('protects FUA creation with the manage privilege', () => {
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
        privilege: fuaManagePrivilege,
        hideUnauthorized: true,
        children: expect.anything(),
      }),
    );
    expect(screen.getByRole('button', { name: /crear fua/i })).toBeInTheDocument();
  });

  it('hides the create action when access is denied', () => {
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

    expect(screen.queryByRole('button', { name: /crear fua/i })).not.toBeInTheDocument();
    expect(mockUseStartVisitIfNeeded).not.toHaveBeenCalled();
    expect(mockUseVisitOrOfflineVisit).not.toHaveBeenCalled();
  });
});
