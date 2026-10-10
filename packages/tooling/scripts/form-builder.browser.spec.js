const assert = require('node:assert/strict');
const { mkdtemp, readFile, readdir, rm, writeFile } = require('node:fs/promises');
const { createServer } = require('node:http');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { rspack } = require('@rspack/core');
const { chromium, expect } = require('@playwright/test');

const root = path.resolve(__dirname, '../../..');

test('bundled form editor retains JSON validation, completion, theme and search without external assets', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sihsalus-ace-browser-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const workspace = path.join(root, 'packages/apps/esm-form-builder-app');
  const configFile = path.join(workspace, 'src/components/schema-editor/ace-config.ts');
  const previous = process.cwd();
  let config;
  try {
    process.chdir(workspace);
    config = require(path.join(workspace, 'rspack.config.js'))({}, { mode: 'production' });
  } finally {
    process.chdir(previous);
  }
  await writeFile(
    path.join(directory, 'entry.js'),
    `import ace from 'ace-builds/src-noconflict/ace';
     import { addCompleter } from ${JSON.stringify(configFile)};
     addCompleter({ getCompletions(editor, session, pos, prefix, callback) {
       callback(null, [{ caption: 'syntheticField', value: 'syntheticField', meta: 'schema' }]);
     }});
     window.editor = ace.edit('editor', { mode: 'ace/mode/json', theme: 'ace/theme/textmate',
       enableBasicAutocompletion: true, enableLiveAutocompletion: true, enableSnippets: true });`,
  );
  const compiler = rspack({
    mode: 'production',
    context: workspace,
    entry: path.join(directory, 'entry.js'),
    output: { path: directory, filename: 'editor.js', publicPath: '/' },
    module: config.module,
    resolve: { ...config.resolve, modules: [path.join(root, 'node_modules')] },
    optimization: config.optimization,
  });
  try {
    const stats = await new Promise((resolve, reject) => {
      compiler.run((error, result) => (error ? reject(error) : resolve(result)));
    });
    assert.equal(stats.hasErrors(), false, stats.toString({ all: false, errors: true }));
    assert.ok((await readdir(directory)).length < 10, 'should not emit the complete Ace catalog');
  } finally {
    await new Promise((resolve, reject) => compiler.close((error) => (error ? reject(error) : resolve())));
  }
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<div id="editor" style="width:700px;height:400px"></div><script src="/editor.js"></script>');
      return;
    }
    try {
      assert.equal(path.basename(pathname), pathname.slice(1));
      response.setHeader('Content-Type', 'text/javascript');
      response.end(await readFile(path.join(directory, path.basename(pathname))));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  const failedRequests = [];
  const origin = `http://127.0.0.1:${server.address().port}`;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failedRequests.push(response.url());
  });
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).origin !== origin) {
      failedRequests.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(origin);
  await expect(page.locator('#editor')).toHaveClass(/ace-tm/);
  await page.evaluate(() => window.editor.setValue('{"synthetic": }', -1));
  await expect.poll(() => page.evaluate(() => window.editor.session.getAnnotations().length)).toBeGreaterThan(0);
  await page.evaluate(() => window.editor.setValue('{"synthetic": 1}', -1));
  await expect.poll(() => page.evaluate(() => window.editor.session.getAnnotations().length)).toBe(0);
  await page.evaluate(() => {
    window.editor.setValue('syn', 1);
    window.editor.focus();
    window.editor.execCommand('startAutocomplete');
  });
  await expect(page.locator('.ace_autocomplete')).toContainText('syntheticField');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.editor.execCommand('find'));
  await expect(page.locator('.ace_search')).toBeVisible();
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
});

const lib = path.join(root, 'packages/libs/esm-form-engine-lib/src');

test('controlled selections settle with asynchronous calculated fields in a production renderer', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sihsalus-form-engine-browser-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  // Keep the renderer, RHF, Carbon controls, expressions and adapters native.
  // Replace external services and registration only; this fixture has no API.
  await writeFile(
    path.join(directory, 'framework.js'),
    `export * from '${path.join(root, 'packages/libs/esm-expression-evaluator/src')}';
     const state = { loaded: true, config: {} };
     export const getConfigStore = () => ({ subscribe: () => () => {}, getState: () => state,
       getInitialState: () => state });
     export const translateFrom = (_module, key, fallback) => fallback ?? key;
     export const showSnackbar = () => {};
     export const formatDate = () => '';
     export const parseDate = value => new Date(value);
     export const attachmentUrl = () => '';
     export const getAttachmentByUuid = () => { throw Error('Unexpected attachment request'); };
     export const openmrsFetch = () => { throw Error('Unexpected API request'); };
     export const restBaseUrl = '/unavailable';
     export const fhirBaseUrl = '/unavailable';
     export const ChevronDownIcon = () => null;
     export const ChevronUpIcon = () => null;`,
  );
  await writeFile(
    path.join(directory, 'i18n.js'),
    `const t = (key, fallback) => fallback ?? key;
     export const useTranslation = () => ({ t });`,
  );
  await writeFile(
    path.join(directory, 'registry.js'),
    `import Dropdown from '${lib}/components/inputs/select/dropdown.component';
     import NumberField from '${lib}/components/inputs/number/number.component';
     import TextArea from '${lib}/components/inputs/text-area/text-area.component';
     export const getRegisteredExpressionHelpers = () => ({});
     export const getPreviewFieldControl = field => field.questionOptions.rendering === 'select'
       ? Dropdown : field.questionOptions.rendering === 'textarea' ? TextArea : NumberField;
     export const getFieldControlWithFallback = async field => getPreviewFieldControl(field);
     export const getRegisteredControl = async () => NumberField;`,
  );
  await writeFile(
    path.join(directory, 'factory.js'),
    `const factory = {
       registerForm: (_name, _subForm, context) => {
         window.formContext = context;
         // Stop a regression rather than leaving Chromium in an infinite loop.
         if (++window.formUpdates > 60) throw Error('Form updates did not settle');
       },
       setIsFormDirty: () => {}, workspaceLayout: 'minimized', isFormExpanded: true,
     };
     export const useFormFactory = () => factory;`,
  );
  await writeFile(path.join(directory, 'processor.js'), 'export default () => null;');
  await writeFile(
    path.join(directory, 'entry.tsx'),
    `import React from 'react';
     import { createRoot } from 'react-dom/client';
     import { ErrorBoundary } from 'react-error-boundary';
     import { FormRenderer } from '${lib}/components/renderer/form/form-renderer.component';
     import { ObsAdapter } from '${lib}/adapters/obs-adapter';
     import { ControlAdapter } from '${lib}/adapters/control-adapter';
     import { FieldValidator } from '${lib}/validators/form-validator';
     const field = (id, label, rendering) => ({ id, label, type: 'obs',
       questionOptions: { rendering, concept: 'synthetic-' + id },
       validators: [{ type: 'form_field' }],
       meta: { initialValue: { omrsObject: null, refinedValue: null }, submission: null } });
     const calculated = new URLSearchParams(location.search).has('calculated');
     const score = field('score', 'Score', 'number');
     score.fieldDependents = new Set(['outcome']);
     const outcome = field('outcome', 'Outcome', 'select');
     outcome.questionOptions.answers = [
       { concept: 'green', label: 'Green' }, { concept: 'yellow', label: 'Yellow' },
       { concept: 'red', label: 'Red' },
     ];
     if (calculated) {
       outcome.readonly = true;
       outcome.questionOptions.calculate = { calculateExpression:
         'isEmpty(score) ? undefined : (score <= 2 ? "green" : score <= 7 ? "yellow" : "red")' };
     }
     outcome.fieldDependents = new Set(['risk']);
     const risk = field('risk', 'Risk', 'number');
     risk.type = 'control';
     risk.readonly = true;
     risk.questionOptions.calculate = { calculateExpression:
       'isEmpty(outcome) ? undefined : (outcome === "red" ? 2 : outcome === "yellow" ? 1 : 0)' };
     risk.fieldDependents = new Set(['plan']);
     const plan = field('plan', 'Plan', 'textarea');
     plan.required = 'risk > 0';
     plan.hide = { hideWhenExpression: 'isEmpty(risk) || risk === 0' };
     const editing = new URLSearchParams(location.search).has('edit');
     if (editing) outcome.meta.initialValue.omrsObject = { uuid: 'synthetic-observation', value: 'green' };
     const fields = calculated ? [score, outcome, risk, plan] : [outcome, risk, plan];
     const schema = { name: 'Synthetic outcome', pages: [{ label: 'Outcome',
       sections: [{ label: 'Assessment', questions: fields }] }] };
     const context = { isPreview: true, formJson: schema, formFields: fields,
       formFieldAdapters: { obs: ObsAdapter, control: ControlAdapter },
       formFieldValidators: { form_field: FieldValidator },
       sessionMode: editing ? 'edit' : 'enter', layoutType: 'small-desktop',
       patient: null, visit: null, sessionDate: new Date('2026-10-10T12:00:00Z'),
       location: null, currentProvider: null, processor: { getHistoricalValue: () => null } };
     window.formUpdates = 0;
     createRoot(document.getElementById('root')).render(
       <ErrorBoundary fallback={<p>Render error</p>} onError={error => { window.renderError = error.message; }}>
         <FormRenderer processorContext={context}
           initialValues={{ score: null, outcome: editing ? 'green' : null, risk: editing ? 0 : null, plan: null }}
           isSubForm={false} setIsLoadingFormDependencies={() => {}} onDependencyError={() => {}} />
       </ErrorBoundary>);`,
  );
  const workspace = path.join(root, 'packages/apps/esm-form-entry-react-app');
  const previous = process.cwd();
  let config;
  try {
    process.chdir(workspace);
    config = require(path.join(workspace, 'rspack.config.js'))({}, { mode: 'production' });
  } finally {
    process.chdir(previous);
  }
  const replacements = [
    [/^@openmrs\/esm-framework(?:\/src\/internal)?$/, 'framework.js'],
    [/^react-i18next$/, 'i18n.js'],
    [/registry\/registry$/, 'registry.js'],
    [/provider\/form-factory-provider$/, 'factory.js'],
    [/processor-factory\/form-processor-factory.component$/, 'processor.js'],
  ];
  const compiler = rspack({
    mode: 'production',
    context: workspace,
    entry: path.join(directory, 'entry.tsx'),
    output: { path: directory, filename: 'renderer.js', publicPath: '/' },
    module: config.module,
    resolve: {
      ...config.resolve,
      modules: [path.join(root, 'node_modules')],
    },
    plugins: replacements
      .map(([pattern, file]) => new rspack.NormalModuleReplacementPlugin(pattern, path.join(directory, file)))
      .concat(
        new rspack.NormalModuleReplacementPlugin(
          /^@openmrs\/esm-utils$/,
          path.join(root, 'packages/libs/esm-utils/src/plain-number-input.ts'),
        ),
      ),
    optimization: config.optimization,
  });
  try {
    const stats = await new Promise((resolve, reject) => {
      compiler.run((error, result) => (error ? reject(error) : resolve(result)));
    });
    assert.equal(stats.hasErrors(), false, stats.toString({ all: false, errors: true }));
  } finally {
    await new Promise((resolve, reject) => compiler.close((error) => (error ? reject(error) : resolve())));
  }
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end('<meta charset="utf-8"><div id="root"></div><script src="/renderer.js"></script>');
      return;
    }
    try {
      assert.equal(path.basename(pathname), pathname.slice(1));
      response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      response.end(await readFile(path.join(directory, path.basename(pathname))));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).origin !== origin || route.request().method() !== 'GET') {
      requests.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  for (const mode of ['calculated', 'enter', 'edit']) {
    const editing = mode === 'edit';
    const calculated = mode === 'calculated';
    await page.goto(`${origin}/${editing ? '?edit' : calculated ? '?calculated' : ''}`);
    const outcome = page.getByRole('combobox', { name: 'Outcome' });
    await expect(outcome).toBeVisible();
    const selections = [
      ['Yellow', 'yellow', '1', true],
      ['Red', 'red', '2', true],
      ['Green', 'green', '0', false],
      ['Yellow', 'yellow', '1', true],
    ];
    for (const [label, value, risk, required] of editing
      ? selections.filter(([label]) => label !== 'Green')
      : selections) {
      if (calculated) {
        await page
          .getByRole('spinbutton', { name: 'Score' })
          .fill(value === 'yellow' ? '3' : value === 'red' ? '8' : '0');
      } else {
        await outcome.click();
        await page.getByRole('option', { name: label, exact: true }).click();
      }
      await expect(outcome).toContainText(label);
      await expect(page.locator('#risk')).toHaveValue(risk);
      await expect(page.locator('#plan')).toBeVisible({ visible: required });
      if (required) await expect(page.getByTestId('plan-label').getByTitle('Required')).toBeVisible();
      const snapshot = await page.evaluate(() => ({
        value: window.formContext.methods.getValues('outcome'),
        observation: window.formContext.getFormField('outcome').meta.submission.newValue,
        error: window.renderError,
      }));
      assert.equal(snapshot.value, value);
      assert.equal(snapshot.observation.value, value);
      if (editing) assert.equal(snapshot.observation.uuid, 'synthetic-observation');
      assert.equal(snapshot.error, undefined);
    }
    const updates = await page.evaluate(() => window.formUpdates);
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.formUpdates), updates, 'dependent updates must settle');
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
});
