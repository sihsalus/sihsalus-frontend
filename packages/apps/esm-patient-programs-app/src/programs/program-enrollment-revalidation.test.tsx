import { getDefaultsFromConfigSchema, openmrsFetch, useConfig, usePatient, useSession } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SWRConfig } from 'swr';
import { mockCareProgramsResponse, mockEnrolledProgramsResponse, mockPatient, mockSession } from 'test-utils';
import { type ConfigObject, configSchema } from '../config-schema';
import DeleteProgramModal from './delete-program.modal';
import ProgramsForm from './programs-form.workspace';
import ProgramsOverview from './programs-overview.component';

const enrollment = mockEnrolledProgramsResponse[0];
const otherPatient = `${mockPatient.id}-other`;
const fetchMock = vi.mocked(openmrsFetch);

beforeEach(() => {
  vi.clearAllMocks();
  window.spaBase = '/openmrs/spa';
  vi.mocked(useSession).mockReturnValue(mockSession.data);
  vi.mocked(usePatient).mockReturnValue({
    patient: mockPatient as unknown as fhir.Patient,
    patientUuid: mockPatient.id,
    isLoading: false,
    error: null,
  });
  vi.mocked(useConfig<ConfigObject>).mockReturnValue({
    ...getDefaultsFromConfigSchema<ConfigObject>(configSchema),
    programNavigationTargets: [
      {
        programUuid: enrollment.program.uuid,
        chartPath: 'maternal-and-child-health',
        historicalChartPath: 'maternal-history',
      },
    ],
  });
});

function renderEnrollmentWorkflow(action: 'complete' | 'delete') {
  let savedEnrollment = { ...enrollment };
  let deleted = false;
  const reads = new Map<string, number>();
  const close = vi.fn();
  fetchMock.mockImplementation(async (url, options) => {
    const request = new URL(String(url), 'http://synthetic.test');
    if (options?.method === 'POST') {
      expect(request.pathname).toBe(`/ws/rest/v1/programenrollment/${enrollment.uuid}`);
      savedEnrollment = {
        ...savedEnrollment,
        dateCompleted: (options.body as { dateCompleted: string }).dateCompleted,
      };
      return Object.assign(new Response(null, { status: 200 }), { data: savedEnrollment });
    }
    if (options?.method === 'DELETE') {
      expect(request.pathname).toBe(`/ws/rest/v1/programenrollment/${enrollment.uuid}`);
      deleted = true;
      return Object.assign(new Response(null, { status: 204 }), { data: null });
    }
    reads.set(String(url), (reads.get(String(url)) ?? 0) + 1);
    if (request.pathname === '/ws/rest/v1/programenrollment') {
      const ownPatient = request.searchParams.get('patient') === mockPatient.id;
      return Object.assign(new Response(null, { status: 200 }), {
        data: {
          results: ownPatient ? (deleted ? [] : [{ ...savedEnrollment }]) : [{ ...enrollment }],
        },
      });
    }
    expect(request.pathname).toBe('/ws/rest/v1/program');
    return Object.assign(new Response(null, { status: 200 }), { data: { results: mockCareProgramsResponse } });
  });

  function Workflow() {
    const [editing, setEditing] = useState(true);
    const closeWorkspace = async () => {
      close();
      setEditing(false);
      return true;
    };
    return (
      <>
        <section aria-label="own patient programs">
          <ProgramsOverview patientUuid={mockPatient.id} basePath="/chart" />
        </section>
        <section aria-label="other patient programs">
          <ProgramsOverview patientUuid={otherPatient} basePath="/chart" />
        </section>
        {editing &&
          (action === 'complete' ? (
            <ProgramsForm
              closeWorkspace={closeWorkspace}
              groupProps={{
                patientUuid: mockPatient.id,
                patient: mockPatient as unknown as fhir.Patient,
                visitContext: null,
                mutateVisitContext: null,
              }}
              workspaceProps={{ programEnrollmentId: enrollment.uuid }}
              workspaceName="programs-form-workspace"
              launchChildWorkspace={vi.fn()}
              windowProps={{}}
              windowName="patient-chart"
              isRootWorkspace={false}
              showActionMenu
            />
          ) : (
            <DeleteProgramModal
              closeDeleteModal={closeWorkspace}
              patientUuid={mockPatient.id}
              programEnrollmentId={enrollment.uuid}
            />
          ))}
      </>
    );
  }

  render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        revalidateOnFocus: false,
        shouldRetryOnError: false,
      }}
    >
      <Workflow />
    </SWRConfig>,
  );
  return { reads, close };
}

it.each(['complete', 'delete'] as const)('refreshes the provider-owned Programs table after %s', async (action) => {
  const user = userEvent.setup();
  const { reads, close } = renderEnrollmentWorkflow(action);
  const own = within(screen.getByRole('region', { name: 'own patient programs' }));
  const other = within(screen.getByRole('region', { name: 'other patient programs' }));
  const ownRow = await own.findByRole('row', { name: /HIV Care and Treatment/i });
  expect(within(ownRow).getByText('Active')).toBeInTheDocument();
  await other.findByRole('row', { name: /HIV Care and Treatment/i });
  const before = new Map(reads);
  if (action === 'complete') {
    fireEvent.change(screen.getByRole('textbox', { name: /date completed/i }), {
      target: { value: '2026-10-10' },
    });
    await user.click(screen.getByRole('button', { name: /save and close/i }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(await own.findByText(/Completed On/)).toBeInTheDocument();
    expect(own.queryByText('Active')).not.toBeInTheDocument();
    expect(own.getByRole('link', { name: 'Go to' })).toHaveAttribute(
      'href',
      `/openmrs/spa/patient/${mockPatient.id}/chart/maternal-history`,
    );
  } else {
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    await waitFor(() => expect(own.queryByRole('row', { name: /HIV Care and Treatment/i })).not.toBeInTheDocument());
  }
  expect(within(other.getByRole('row', { name: /HIV Care and Treatment/i })).getByText('Active')).toBeInTheDocument();
  for (const [key, count] of before) {
    if (key.includes(`patient=${otherPatient}`) || key.includes('/program?')) {
      expect({ key, count: reads.get(key) }).toEqual({ key, count });
    }
  }
});
