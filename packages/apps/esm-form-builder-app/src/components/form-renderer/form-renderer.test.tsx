import { type FetchResponse, launchWorkspace2, openmrsFetch, showModal, usePatient } from '@openmrs/esm-framework';
import { type FormSchema } from '@sihsalus/esm-form-engine-lib';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18next from 'i18next';
import { SWRConfig } from 'swr';
import { pageObserver } from '../../../../../libs/esm-form-engine-lib/src/components/sidebar/page-observer';
import FormRenderer from './form-renderer.component';

// Exercise the real engine and field renderers; only infrastructure is replaced.
vi.mock('@sihsalus/esm-form-engine-lib', () => import('../../../../../libs/esm-form-engine-lib/src/index'));
vi.mock('@openmrs/esm-framework/src/internal', async () => {
  const framework = await import('@openmrs/esm-framework');
  const config = framework.createGlobalStore('synthetic-preview-config', { loaded: true, config: {} });
  return { ...framework, getConfigStore: () => config };
});

const schema: FormSchema = {
  name: 'Synthetic preview',
  uuid: 'synthetic-preview-form',
  processor: 'EncounterFormProcessor',
  encounterType: 'synthetic-encounter-type',
  referencedForms: [],
  pages: [
    {
      label: 'Synthetic page',
      sections: [
        {
          label: 'Synthetic section',
          isExpanded: true,
          questions: [
            { id: 'sample', label: 'Synthetic answer', type: 'control', questionOptions: { rendering: 'text' } },
          ],
        },
      ],
    },
  ],
};

beforeAll(async () => {
  const instance = i18next.createInstance();
  await instance.init({ lng: 'en', resources: {}, initImmediate: false });
  window.i18next = instance;
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(usePatient).mockReturnValue({ patient: null, patientUuid: null, isLoading: false, error: null });
  vi.mocked(openmrsFetch).mockRejectedValue(new Error('Unexpected request in a schema-only preview'));
});

afterEach(() => vi.restoreAllMocks());

function renderPreview(value: FormSchema | null = schema) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <FormRenderer schema={value} isLoading={false} />
    </SWRConfig>,
  );
}

it('renders editable sample fields without a patient, clinical reads, or submission controls', async () => {
  const original = JSON.stringify(schema);
  const { container } = renderPreview();
  const input = await screen.findByRole('textbox', { name: 'Synthetic answer' });
  await userEvent.type(input, 'Synthetic response');
  expect(input).toHaveValue('Synthetic response');
  expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
  const form = container.querySelector('form');
  expect(form).toBeInTheDocument();
  fireEvent.submit(form);
  act(() =>
    window.dispatchEvent(
      new CustomEvent('ampath-form-action', {
        detail: { formUuid: schema.uuid, patientUuid: 'synthetic-patient', action: 'onSubmit' },
      }),
    ),
  );
  expect(usePatient).not.toHaveBeenCalled();
  expect(openmrsFetch).not.toHaveBeenCalled();
  expect(showModal).not.toHaveBeenCalled();
  expect(launchWorkspace2).not.toHaveBeenCalled();
  expect(JSON.stringify(schema)).toBe(original);
});

it('replaces the preview and sample values when a schema with the same UUID changes', async () => {
  const { rerender } = renderPreview();
  await userEvent.type(await screen.findByRole('textbox', { name: 'Synthetic answer' }), 'Temporary sample');
  const changed = structuredClone(schema);
  changed.pages[0].sections[0].questions[0].label = 'Updated synthetic answer';
  changed.pages[0].sections[0].questions[0].questionOptions.defaultValue = 'Schema default';
  rerender(<FormRenderer schema={changed} isLoading={false} />);
  expect(await screen.findByRole('textbox', { name: 'Updated synthetic answer' })).toHaveValue('Schema default');
  expect(screen.queryByRole('textbox', { name: 'Synthetic answer' })).not.toBeInTheDocument();
  expect(changed.pages[0].sections[0].questions[0]).not.toHaveProperty('meta');
  expect(openmrsFetch).not.toHaveBeenCalled();
});

it('reports an invalid schema safely and recovers after it is corrected', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const invalid = { ...schema, pages: null } as FormSchema;
  const { rerender } = renderPreview(invalid);
  expect(await screen.findByText('There was a problem loading the form preview')).toBeInTheDocument();
  expect(screen.getByText('Check the questions and the Validation tab for schema errors.')).toBeInTheDocument();
  expect(screen.queryByText(/TypeError|Cannot read|Form preview could not be loaded/)).not.toBeInTheDocument();
  rerender(<FormRenderer schema={schema} isLoading={false} />);
  expect(await screen.findByRole('textbox', { name: 'Synthetic answer' })).toBeEnabled();
  expect(screen.queryByText('There was a problem loading the form preview')).not.toBeInTheDocument();
});

it('renders an empty schema without waiting forever for initial values', async () => {
  renderPreview({ ...schema, pages: [{ label: 'Empty synthetic page', sections: [] }] });
  await waitFor(() => expect(screen.queryByText('Loading ...')).not.toBeInTheDocument());
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
  expect(openmrsFetch).not.toHaveBeenCalled();
});

it('keeps loading and empty states separate from the last rendered form', async () => {
  const { rerender } = renderPreview();
  await screen.findByRole('textbox', { name: 'Synthetic answer' });
  rerender(<FormRenderer schema={schema} isLoading />);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  rerender(<FormRenderer schema={null} isLoading={false} />);
  expect(screen.getByText('No schema loaded')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it.each([
  'workspace-launcher',
  'file',
  'extension-widget',
  'custom-control',
])('does not mount external actions for %s', async (rendering) => {
  const changed = structuredClone(schema);
  changed.pages[0].sections[0].questions[0].questionOptions.rendering = rendering as never;
  changed.pages[0].sections[0].questions[0].questionOptions.workspaceName = 'clinical-workspace';
  renderPreview(changed);
  expect(await screen.findByRole('note')).toHaveTextContent('not available in the schema preview');
  expect(showModal).not.toHaveBeenCalled();
  expect(launchWorkspace2).not.toHaveBeenCalled();
  expect(openmrsFetch).not.toHaveBeenCalled();
});

it('does not execute a custom datasource or publish sample page state to a clinical form', async () => {
  const pageUpdates = vi.spyOn(pageObserver, 'updateScrollablePages');
  const activePages = vi.spyOn(pageObserver, 'addActivePage');
  const changed = structuredClone(schema);
  changed.pages[0].sections[0].questions[0].questionOptions = {
    rendering: 'ui-select-extended',
    datasource: { name: 'synthetic-external-datasource' },
  };
  const { unmount } = renderPreview(changed);
  await screen.findByRole('note');
  unmount();
  expect(openmrsFetch).not.toHaveBeenCalled();
  expect(pageUpdates).not.toHaveBeenCalled();
  expect(activePages).not.toHaveBeenCalled();
});

it.each([
  'obs',
  'patientIdentifier',
  'personAttribute',
])('previews %s fields without invoking their patient adapters', async (type) => {
  const changed = structuredClone(schema);
  changed.pages[0].sections[0].questions[0].type = type as never;
  renderPreview(changed);
  await userEvent.type(await screen.findByRole('textbox', { name: 'Synthetic answer' }), 'Sample only');
  expect(usePatient).not.toHaveBeenCalled();
  expect(openmrsFetch).not.toHaveBeenCalled();
});

it('uses the existing concept lookup to display configured observation fields', async () => {
  const changed = structuredClone(schema);
  changed.pages[0].sections[0].questions[0].type = 'obs';
  changed.pages[0].sections[0].questions[0].questionOptions.concept = 'synthetic-concept';
  vi.mocked(openmrsFetch).mockResolvedValue({
    data: {
      'synthetic-concept': {
        uuid: 'synthetic-concept',
        display: 'Synthetic concept',
        answers: [],
        conceptMappings: [],
        conceptClass: { uuid: 'synthetic-class', display: 'Question' },
      },
    },
  } as FetchResponse);
  renderPreview(changed);
  expect(await screen.findByRole('textbox', { name: 'Synthetic answer' })).toBeEnabled();
  expect(openmrsFetch).toHaveBeenCalledOnce();
  expect(openmrsFetch).toHaveBeenCalledWith(
    expect.stringContaining('/conceptreferences?'),
    expect.objectContaining({
      method: 'POST',
      body: { references: ['synthetic-concept'] },
    }),
  );
  expect(usePatient).not.toHaveBeenCalled();
});

it('uses the preview processor for referenced subforms too', async () => {
  const child = structuredClone(schema);
  child.uuid = 'synthetic-child-form';
  child.name = 'SyntheticChild';
  child.encounterType = 'synthetic-child-encounter-type';
  child.pages[0].sections[0].questions[0].label = 'Synthetic child answer';
  const parent = {
    ...schema,
    pages: [{ label: 'Child page', isSubform: true, subform: { name: 'SyntheticChild' }, sections: [] }],
  } as FormSchema;
  vi.mocked(openmrsFetch).mockImplementation(async (url) => {
    if (String(url).includes('/form?q=SyntheticChild&v=full'))
      return {
        data: {
          results: [
            {
              uuid: child.uuid,
              retired: false,
              resources: [{ name: 'JSON schema', valueReference: 'synthetic-child-clob' }],
            },
          ],
        },
      } as FetchResponse;
    if (String(url).endsWith('/clobdata/synthetic-child-clob')) return { data: child } as FetchResponse;
    throw new Error('Unexpected clinical request from preview');
  });
  renderPreview(parent);
  expect(await screen.findByRole('textbox', { name: 'Synthetic child answer' })).toBeEnabled();
  expect(openmrsFetch).toHaveBeenCalledTimes(2);
  expect(usePatient).not.toHaveBeenCalled();
});

it('does not replace translations used by an open clinical form', async () => {
  const namespace = '@openmrs/esm-form-engine-app';
  window.i18next.addResourceBundle('en', namespace, { 'Synthetic answer': 'Published label' }, true, true);
  const changed = structuredClone(schema);
  changed.translations = { 'Synthetic answer': 'Draft label' };
  const { unmount } = renderPreview(changed);
  await screen.findByRole('textbox');
  expect(window.i18next.getResource('en', namespace, 'Synthetic answer')).toBe('Published label');
  unmount();
  expect(window.i18next.getResource('en', namespace, 'Synthetic answer')).toBe('Published label');
});
