import { ExtensionSlot, useConfig, useConnectivity, usePatient, Workspace2 } from '@openmrs/esm-framework';
import { useVisitOrOfflineVisit } from '@openmrs/esm-patient-common-lib';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { mockPatient } from 'test-utils';

import FormEntryWorkspace from './form-entry.workspace';

void React;

const mockFhirPatient = mockPatient as unknown as fhir.Patient;
const mockExtensionSlot = vi.mocked(ExtensionSlot);
const mockUseVisitOrOfflineVisit = useVisitOrOfflineVisit as vi.Mock;
const mockUsePatient = vi.mocked(usePatient);
const mockWorkspace2 = vi.mocked(Workspace2);
const mockUseConfig = vi.mocked(useConfig);
const mockUseConnectivity = vi.mocked(useConnectivity);
const mockUseSWR = useSWR as vi.Mock;
const mockUseSWRConfig = useSWRConfig as vi.Mock;
const workspace2DefinitionProps = {
  launchChildWorkspace: vi.fn(),
  windowProps: {},
  workspaceName: 'patient-form-entry-workspace-v2',
  windowName: 'patient-chart-workspace-window',
  isRootWorkspace: true,
  showActionMenu: false,
};

const mockCurrentVisit = {
  uuid: '17f512b4-d264-4113-a6fe-160cb38cb46e',
  encounters: [],
  patient: { uuid: '8673ee4f-e2ab-4077-ba55-4980f408773e' },
  visitType: {
    uuid: '7b0f5697-27e3-40c4-8bae-f4049abfb4ed',
    display: 'Facility Visit',
  },
  attributes: [],
  startDatetime: new Date('2021-03-16T08:16:00.000+0000').toISOString(),
  stopDatetime: null,
  location: {
    uuid: '6351fcf4-e311-4a19-90f9-35667d99a8af',
    name: 'Registration Desk',
    display: 'Registration Desk',
  },
};

vi.mock('../hooks/use-forms', async () => ({
  useForms: vi.fn().mockReturnValue({ mutateForms: vi.fn() }),
}));

vi.mock('swr', async () => {
  const actual = await vi.importActual('swr');

  return {
    __esModule: true,
    ...actual,
    default: vi.fn(),
    useSWRConfig: vi.fn(),
  };
});

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  return {
    clinicalFormsWorkspace: 'clinical-forms-workspace',
    invalidateVisitAndEncounterData: vi.fn(),
    useVisitOrOfflineVisit: vi.fn(),
  };
});

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  ExtensionSlot: vi.fn().mockImplementation(({ name }: { name?: string }) => name),
  Workspace2: vi.fn().mockImplementation(({ children }: { children?: React.ReactNode }) => <div>{children}</div>),
  usePatient: vi.fn(),
  useConfig: vi.fn(),
  useConnectivity: vi.fn(),
  openmrsFetch: vi.fn(),
}));

describe('FormEntryWorkspace', () => {
  beforeEach(() => {
    mockUsePatient.mockReturnValue({
      patient: mockFhirPatient,
      patientUuid: mockPatient.uuid,
      error: null,
      isLoading: false,
    });
    mockUseVisitOrOfflineVisit.mockReturnValue({
      currentVisit: mockCurrentVisit,
    });
    mockUseConfig.mockReturnValue({ htmlFormEntryForms: [] });
    mockUseConnectivity.mockReturnValue(true);
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false });
    mockUseSWRConfig.mockReturnValue({ mutate: vi.fn() });
  });

  it('keeps the legacy formInfo path working for compatibility callers', async () => {
    render(
      <FormEntryWorkspace
        {...workspace2DefinitionProps}
        closeWorkspace={vi.fn()}
        groupProps={{
          patientUuid: mockPatient.uuid,
          patient: mockFhirPatient,
          visitContext: mockCurrentVisit,
          mutateVisitContext: vi.fn(),
        }}
        workspaceProps={
          {
            formInfo: { formUuid: 'some-form-uuid' },
            mutateForm: vi.fn(),
          } as any
        }
      />,
    );

    await waitFor(() =>
      expect(mockExtensionSlot).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'form-widget-slot',
          state: expect.objectContaining({
            formUuid: 'some-form-uuid',
            patientUuid: mockPatient.uuid,
            visit: expect.objectContaining({
              uuid: mockCurrentVisit.uuid,
            }),
          }),
        }),
        expect.anything(),
      ),
    );
  });

  it('renders the workspace2 form-entry path for v12-shaped callers', async () => {
    render(
      <FormEntryWorkspace
        {...workspace2DefinitionProps}
        closeWorkspace={vi.fn()}
        groupProps={{
          patientUuid: mockPatient.uuid,
          patient: mockFhirPatient,
          visitContext: mockCurrentVisit,
          mutateVisitContext: vi.fn(),
        }}
        workspaceProps={
          {
            form: {
              uuid: 'some-form-uuid',
              name: 'Test form',
              display: 'Test form',
              version: '1',
              published: true,
              retired: false,
              resources: [],
            },
          } as any
        }
      />,
    );

    await waitFor(() => expect(mockWorkspace2).toHaveBeenCalled());
    expect(mockExtensionSlot).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'visit-context-header-slot',
        state: { patientUuid: mockPatient.uuid },
      }),
      expect.anything(),
    );
    expect(mockExtensionSlot).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'form-widget-slot',
        state: expect.objectContaining({
          formUuid: 'some-form-uuid',
          patientUuid: mockPatient.uuid,
          visit: mockCurrentVisit,
        }),
      }),
      expect.anything(),
    );
  });

  it('keeps the workspace2 form slot state stable when closeWorkspace changes', async () => {
    const workspaceProps = {
      form: {
        uuid: 'some-form-uuid',
        name: 'Test form',
        display: 'Test form',
        version: '1',
        published: true,
        retired: false,
        resources: [],
      },
    } as any;
    const groupProps = {
      patientUuid: mockPatient.uuid,
      patient: mockFhirPatient,
      visitContext: mockCurrentVisit,
      mutateVisitContext: vi.fn(),
    };
    const { rerender } = render(
      <FormEntryWorkspace
        {...workspace2DefinitionProps}
        closeWorkspace={vi.fn()}
        groupProps={groupProps}
        workspaceProps={workspaceProps}
      />,
    );

    await waitFor(() =>
      expect(
        mockExtensionSlot.mock.calls.find(([props]: Array<any>) => props.name === 'form-widget-slot')?.[0]?.state,
      ).toBeDefined(),
    );

    const initialState = mockExtensionSlot.mock.calls.find(
      ([props]: Array<any>) => props.name === 'form-widget-slot',
    )?.[0]?.state;

    rerender(
      <FormEntryWorkspace
        {...workspace2DefinitionProps}
        closeWorkspace={vi.fn()}
        groupProps={groupProps}
        workspaceProps={workspaceProps}
      />,
    );

    await waitFor(() =>
      expect(
        mockExtensionSlot.mock.calls.filter(([props]: Array<any>) => props.name === 'form-widget-slot').length,
      ).toBeGreaterThan(1),
    );

    const nextState = mockExtensionSlot.mock.calls
      .filter(([props]: Array<any>) => props.name === 'form-widget-slot')
      .at(-1)?.[0]?.state;

    const normalizeEncounterUuid = (encounterUuid: unknown) => (typeof encounterUuid === 'string' ? encounterUuid : '');

    expect(nextState?.formUuid).toBe(initialState?.formUuid);
    expect(nextState?.patientUuid).toBe(initialState?.patientUuid);
    expect(normalizeEncounterUuid(nextState?.encounterUuid)).toBe(normalizeEncounterUuid(initialState?.encounterUuid));
    expect(nextState?.additionalProps).toEqual(initialState?.additionalProps ?? {});
  });
});
