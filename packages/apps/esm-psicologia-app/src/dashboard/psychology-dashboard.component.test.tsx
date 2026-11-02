import { ErrorState, openmrsFetch, useConfig, userHasAccess } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Encounter, Observation } from '../types';
import EncounterObservations from './encounter-observations/encounter-observations.component';
import PsychologyDashboard from './psychology-dashboard.component';
import { useEncounters } from './useEncounters';

// Keep the real shared UI and replace only the workspace side effect.
vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const { CardHeader } = await import('../../../../libs/esm-patient-common-lib/src/cards/card-header.component');
  const { EmptyState } = await import('../../../../libs/esm-patient-common-lib/src/empty-state/empty-state.component');
  return { CardHeader, EmptyState, launchPatientWorkspace: vi.fn() };
});

const patientUuid = 'synthetic-patient';
const encounterTypeUuid = 'synthetic-psychology-type';
const formUuid = 'synthetic-psychology-form';
const hiddenObservation: Observation = {
  uuid: 'synthetic-hidden-observation',
  concept: { uuid: 'synthetic-hidden-concept', display: 'Hidden field' },
  display: 'Hidden field: hidden answer',
  groupMembers: null,
  value: 'hidden answer',
};
const encounter: Encounter = {
  uuid: 'synthetic-psychology-encounter',
  encounterDatetime: '2026-01-15T12:00:00.000Z',
  encounterType: { uuid: encounterTypeUuid },
  form: { uuid: formUuid },
  visit: { visitType: { display: 'Synthetic consultation' } },
  encounterProviders: [{ provider: { display: 'SYNTHETIC CLINICIAN - TEST ID' } }],
  obs: [
    {
      uuid: 'synthetic-note',
      concept: { uuid: 'synthetic-note-concept', display: 'Clinical note' },
      display: 'Clinical note: Synthetic result: additional detail',
      groupMembers: null,
      value: 'Synthetic result: additional detail',
    },
    {
      uuid: 'synthetic-observation-group',
      concept: { uuid: 'synthetic-group-concept', display: 'Synthetic assessment' },
      display: 'Synthetic assessment',
      value: null,
      groupMembers: [
        {
          uuid: 'synthetic-group-member',
          concept: { uuid: 'synthetic-result-concept', display: 'Assessment result' },
          display: 'Assessment result: Synthetic finding',
          value: { uuid: 'synthetic-result-value', display: 'Synthetic finding' },
        },
      ],
    },
    hiddenObservation,
  ],
};

function response(results: Encounter[]) {
  return Object.assign(new Response(), { data: { results } });
}

function SwrBoundary({ children }: PropsWithChildren) {
  return (
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        shouldRetryOnError: false,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}

function renderDashboard() {
  return render(<PsychologyDashboard patientUuid={patientUuid} />, { wrapper: SwrBoundary });
}

beforeEach(() => {
  vi.mocked(openmrsFetch).mockReset();
  vi.mocked(openmrsFetch).mockResolvedValue(response([]));
  vi.mocked(useConfig).mockReturnValue({
    encounterTypeUuid,
    formUuid,
    obsConceptUuidsToHide: [hiddenObservation.concept.uuid],
  });
  vi.mocked(userHasAccess).mockReturnValue(false);
});

afterEach(cleanup);

describe('Psicología encounter queries', () => {
  it.each([
    ['', formUuid, patientUuid],
    [encounterTypeUuid, '', patientUuid],
    [encounterTypeUuid, formUuid, ''],
  ])('does not fetch without the required type, form and patient (%s, %s, %s)', (type, form, patient) => {
    const { result } = renderHook(() => useEncounters(type, form, patient), { wrapper: SwrBoundary });

    expect(openmrsFetch).not.toHaveBeenCalled();
    expect(result.current.encounters).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('scopes the request to the current patient and excludes encounters of another type or form', async () => {
    vi.mocked(openmrsFetch).mockResolvedValue(
      response([
        encounter,
        { ...encounter, uuid: 'other-type', encounterType: { uuid: 'other-type' } },
        { ...encounter, uuid: 'other-form', form: { uuid: 'other-form' } },
      ]),
    );
    const { result } = renderHook(() => useEncounters(encounterTypeUuid, formUuid, patientUuid), {
      wrapper: SwrBoundary,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const requested = new URL(String(vi.mocked(openmrsFetch).mock.calls[0][0]), 'https://synthetic.invalid');
    expect(requested.pathname).toBe('/ws/rest/v1/encounter');
    expect(Object.fromEntries(requested.searchParams)).toEqual({
      patient: patientUuid,
      encounterType: encounterTypeUuid,
      form: formUuid,
      v: 'full',
    });
    expect(result.current.encounters).toEqual([encounter]);
  });

  it('does not retain the previous patient history when switching to a patient with no encounters', async () => {
    vi.mocked(openmrsFetch).mockResolvedValueOnce(response([encounter])).mockResolvedValueOnce(response([]));
    const { result, rerender } = renderHook(
      ({ patient }) => useEncounters(encounterTypeUuid, formUuid, patient),
      { initialProps: { patient: patientUuid }, wrapper: SwrBoundary },
    );
    await waitFor(() => expect(result.current.encounters).toEqual([encounter]));

    rerender({ patient: 'synthetic-other-patient' });

    expect(result.current.encounters).toEqual([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.encounters).toEqual([]);
    expect(openmrsFetch).toHaveBeenLastCalledWith(expect.stringContaining('patient=synthetic-other-patient&'));
  });
});

describe('Psicología dashboard', () => {
  it('shows loading without presenting an empty history or allowing entry', () => {
    vi.mocked(openmrsFetch).mockReturnValue(new Promise(() => {}));
    renderDashboard();

    expect(screen.getByLabelText('Psychology encounters')).toBeInTheDocument();
    expect(screen.queryByText(/There are no .* to display for this patient/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Record|Add/ })).not.toBeInTheDocument();
    expect(launchPatientWorkspace).not.toHaveBeenCalled();
  });

  it('forwards a failed query to the error state instead of reporting no encounters', async () => {
    const error = new Error('Synthetic unavailable response');
    vi.mocked(openmrsFetch).mockRejectedValue(error);
    renderDashboard();

    expect(await screen.findByText('Error State')).toBeInTheDocument();
    expect(ErrorState).toHaveBeenCalledWith(expect.objectContaining({ headerTitle: 'Psicología', error }), expect.anything());
    expect(screen.queryByText(/There are no .* to display for this patient/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Record|Add/ })).not.toBeInTheDocument();
    expect(launchPatientWorkspace).not.toHaveBeenCalled();
  });

  it('shows an empty history without a write action when the edit privilege is absent', async () => {
    renderDashboard();

    expect(await screen.findByText(/There are no .* to display for this patient/)).toBeVisible();
    expect(vi.mocked(userHasAccess).mock.calls[0][0]).toBe('app:hoja.clinica.psicologia.editar');
    expect(screen.queryByRole('button', { name: /Record|Add|Edit|Delete/ })).not.toBeInTheDocument();
  });

  it('opens the configured form for the current patient when recording the first encounter is allowed', async () => {
    vi.mocked(userHasAccess).mockReturnValue(true);
    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /Record/ }));

    expect(launchPatientWorkspace).toHaveBeenCalledWith('patient-form-entry-workspace', {
      workspaceTitle: 'Psicología',
      mutateForm: expect.any(Function),
      formInfo: { patientUuid, encounterUuid: '', formUuid, additionalProps: {} },
    });
  });

  it('displays ordinary and grouped observations while hiding configured fields and write actions', async () => {
    vi.mocked(openmrsFetch).mockResolvedValue(response([encounter]));
    const user = userEvent.setup();
    renderDashboard();

    expect(await screen.findByText('Synthetic consultation')).toBeVisible();
    expect(screen.getByRole('table', { name: 'Psychology encounters' })).toBeVisible();
    expect(screen.getByText('Synthetic clinician')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Expand current row/i }));

    expect(screen.getByText('Clinical note')).toBeVisible();
    expect(screen.getByText('Synthetic result: additional detail')).toBeVisible();
    expect(screen.getByText('Synthetic assessment')).toBeVisible();
    expect(screen.getByText('Assessment result')).toBeVisible();
    expect(screen.getByText('Synthetic finding')).toBeVisible();
    expect(screen.queryByText('Hidden field')).not.toBeInTheDocument();
    expect(screen.queryByText('hidden answer')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add|Edit|Delete/ })).not.toBeInTheDocument();
  });

  it('opens the selected encounter for editing with the configured patient and form', async () => {
    vi.mocked(userHasAccess).mockReturnValue(true);
    vi.mocked(openmrsFetch).mockResolvedValue(response([encounter]));
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByText('Synthetic consultation');
    await user.click(screen.getByRole('button', { name: /Expand current row/i }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(launchPatientWorkspace).toHaveBeenCalledWith('patient-form-entry-workspace', {
      workspaceTitle: 'Psicología',
      mutateForm: expect.any(Function),
      formInfo: { patientUuid, encounterUuid: encounter.uuid, formUuid, additionalProps: {} },
    });
  });

  it('reports no observations for an empty or fully hidden encounter without inventing clinical values', () => {
    const { rerender } = render(<EncounterObservations observations={[hiddenObservation]} />);
    expect(screen.getByText('No observations found')).toBeVisible();
    expect(screen.queryByText('hidden answer')).not.toBeInTheDocument();

    rerender(<EncounterObservations observations={[]} />);
    expect(screen.getByText('No observations found')).toBeVisible();
    expect(screen.queryByText('Clinical note')).not.toBeInTheDocument();
  });
});
