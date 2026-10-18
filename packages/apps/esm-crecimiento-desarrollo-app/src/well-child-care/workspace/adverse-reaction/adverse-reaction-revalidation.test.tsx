import { getDefaultsFromConfigSchema, openmrsFetch, showSnackbar, useConfig, useVisit } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { type ConfigObject, configSchema } from '../../../config-schema';
import { useAdverseReactions } from './adverse-reaction.resource';
import AdverseReactionFormWorkspace from './adverseReaction.component';

vi.mock('@sihsalus/esm-rbac', () => ({ RequirePrivilege: ({ children }) => children }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key, fallback) => fallback }) }));

it.each([false, true])(
  'refreshes only the current patient and never repeats a confirmed save (refresh fails: %s)',
  async (refreshFails) => {
    const config = getDefaultsFromConfigSchema<ConfigObject>(configSchema);
    vi.mocked(useConfig).mockReturnValue(config);
    vi.mocked(useVisit).mockReturnValue({ activeVisit: { location: { uuid: 'synthetic-location' } } } as ReturnType<
      typeof useVisit
    >);
    const reads = new Map<string, number>();
    let saved = false;
    let writes = 0;
    vi.mocked(openmrsFetch).mockImplementation(async (url, options) => {
      const request = new URL(String(url), 'https://synthetic.test');
      if (options?.method === 'POST') {
        writes++;
        saved = true;
        return { data: { uuid: 'synthetic-reaction' } } as never;
      }
      if (request.pathname.endsWith('/form')) {
        return { data: { results: [{ uuid: 'synthetic-form', name: config.formsList.adverseReactionForm }] } } as never;
      }
      const patient = request.searchParams.get('patient');
      reads.set(patient, (reads.get(patient) ?? 0) + 1);
      if (patient === 'synthetic-child' && saved && refreshFails) throw new Error('private refresh failure');
      return {
        data: {
          results:
            patient === 'synthetic-child' && saved
              ? [
                  {
                    uuid: 'synthetic-reaction',
                    encounterDatetime: '2026-01-02T00:00:00Z',
                    form: { name: config.formsList.adverseReactionForm },
                    obs: [],
                  },
                ]
              : [],
        },
      } as never;
    });

    function Table({ patientUuid }: { patientUuid: string }) {
      const { reactions, isLoading } = useAdverseReactions(patientUuid, config);
      return <output aria-label={patientUuid}>{isLoading ? 'Loading' : reactions.length}</output>;
    }
    // Keep the form mounted after close to also exercise duplicate-submit protection.
    const closeWorkspace = vi.fn().mockResolvedValue(false);
    render(
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false, revalidateOnFocus: false }}
      >
        <Table patientUuid="synthetic-child" />
        <Table patientUuid="other-child" />
        <AdverseReactionFormWorkspace patientUuid="synthetic-child" closeWorkspace={closeWorkspace} />
      </SWRConfig>,
    );
    await waitFor(() => expect(screen.getByLabelText('synthetic-child')).toHaveTextContent('0'));
    await waitFor(() => expect(screen.getByLabelText('other-child')).toHaveTextContent('0'));
    const otherReads = reads.get('other-child');
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/Vacuna/), 'BCG');
    await user.selectOptions(screen.getByLabelText(/Severidad/), 'mild');
    await user.type(screen.getByLabelText(/Descripción de la reacción/), 'Synthetic reaction');
    fireEvent.change(screen.getByLabelText(/Fecha de ocurrencia/), { target: { value: '2026-01-02' } });
    const submit = screen.getByRole('button', { name: 'Registrar Reacción' });
    await user.click(submit);
    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledOnce());
    expect(reads.get('other-child')).toBe(otherReads);
    expect(reads.get('synthetic-child')).toBe(2);
    if (refreshFails) {
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'warning',
          subtitle: 'The reaction was saved. Reload the table to see it; do not register it again.',
        }),
      );
    } else {
      expect(screen.getByLabelText('synthetic-child')).toHaveTextContent('1');
    }
    expect(submit).toBeDisabled();
    fireEvent.submit(submit.closest('form'));
    expect(writes).toBe(1);
  },
);
