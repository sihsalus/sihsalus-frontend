const assert = require('node:assert/strict');
const { mkdtemp, readdir, rm, writeFile } = require('node:fs/promises');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { chromium, expect } = require('@playwright/test');
const { getAppShellPackageRoot, getAppShellWebpackConfig } = require('./build-app-shell');

const repositoryRoot = path.resolve(__dirname, '../../..');
// Resolve the compiler through the workspace that owns the loader dependencies.
const configRequire = createRequire(path.join(repositoryRoot, 'packages/tooling/rspack-config/package.json'));
const { rspack } = configRequire('@rspack/core');
const appShellRequire = createRequire(path.join(getAppShellPackageRoot(), 'package.json'));
const webpack = appShellRequire('webpack');
const MiniCssExtractPlugin = appShellRequire('mini-css-extract-plugin');

const styleOwners = [
  { directory: 'apps/esm-patient-imaging-app', configFile: 'rspack.config.js' },
  { directory: 'apps/esm-stock-management-app', configFile: 'rspack.config.js' },
  { directory: 'apps/esm-user-onboarding-app', configFile: 'rspack.config.js' },
  { directory: 'libs/esm-styleguide', configFile: 'rspack.config.cjs', extractCss: true },
  { directory: '@openmrs/esm-app-shell', appShell: true, extractCss: true },
];

let browser;

test('antecedent workspaces keep fields scrollable and actions visible at narrow and tablet widths', async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'antecedent-workspaces-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const workspace = path.join(repositoryRoot, 'packages/apps/esm-patient-conditions-app');
  const config = loadConfig(workspace, 'rspack.config.js');
  const outputPath = path.join(fixture, 'dist');
  const owners = [
    'apps/esm-patient-conditions-app/src/conditions/conditions-form.scss',
    'libs/esm-patient-common-lib/src/antecedents/condition-concept-set-form.scss',
  ];
  await writeFile(
    path.join(fixture, 'entry.js'),
    owners
      .map(
        (owner, index) => `import styles${index} from ${JSON.stringify(path.join(repositoryRoot, 'packages', owner))};`,
      )
      .join('\n') + '\nwindow.conditionStyles = [styles0, styles1];',
  );
  await compile(
    {
      context: workspace,
      mode: config.mode,
      entry: path.join(fixture, 'entry.js'),
      output: { ...config.output, path: outputPath, filename: 'styles.js', publicPath: '' },
      module: config.module,
      resolve: config.resolve,
      optimization: config.optimization,
      plugins: config.plugins.filter((plugin) => plugin instanceof rspack.CssExtractRspackPlugin),
      devtool: false,
      performance: false,
    },
    rspack,
  );
  const context = await browser.newContext({ offline: true });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.setContent(
    '<main id="workspace"><form id="form"><div id="content">' +
      '<fieldset id="fields"><div id="types"><div class="cds--radio-button-group">' +
      ['Patológico', 'Familiar', 'Quirúrgico', 'Hospitalización previa', 'Social', 'Otro']
        .map((label) => `<label class="cds--radio-button-wrapper"><input type="radio" name="type">${label}</label>`)
        .join('') +
      '</div></div><div style="height:1200px">Campos del antecedente</div>' +
      '</fieldset></div><footer id="actions"><div id="buttons"><button type="button">Cancelar</button>' +
      '<button type="submit">Guardar y cerrar</button></div></footer></form></main>',
  );
  for (const asset of (await readdir(outputPath)).filter((file) => file.endsWith('.css'))) {
    await page.addStyleTag({ path: path.join(outputPath, asset) });
  }
  await page.addScriptTag({ path: path.join(outputPath, 'styles.js') });
  await page.addStyleTag({
    content: '*{box-sizing:border-box}body{margin:0}#workspace{height:500px}#buttons{display:flex}',
  });
  for (const [index, app] of owners.entries()) {
    await page.evaluate((owner) => {
      const styles = window.conditionStyles[owner];
      for (const [id, key] of Object.entries({
        form: 'form',
        content: 'formContent',
        fields: 'formContainer',
        actions: 'formActions',
      })) {
        document.getElementById(id).className = styles[key];
      }
      document.getElementById('types').className = styles.typeOptions ?? styles.categoryGrid ?? '';
      document.querySelectorAll('button').forEach((button) => {
        button.className = styles.button;
      });
    }, index);
    for (const width of [320, 420, 768]) {
      await page.setViewportSize({ width, height: 500 });
      const before = await page.locator('#actions').boundingBox();
      assert.ok(before.y + before.height <= 500, `${app}: actions fit at ${width}px`);
      await page.locator('#content').evaluate((content) => {
        content.scrollTop = content.scrollHeight;
      });
      assert.ok(await page.locator('#content').evaluate((content) => content.scrollTop > 0), `${app}: fields scroll`);
      assert.deepEqual(await page.locator('#actions').boundingBox(), before, `${app}: actions stay in place`);
      assert.ok(
        await page.locator('#form').evaluate((form) => form.scrollWidth <= form.clientWidth),
        `${app}: no horizontal overflow`,
      );
      await expect(page.getByRole('button', { name: 'Guardar y cerrar' })).toBeInViewport();
    }
  }
});

test('imaging actions remain visible and clinical tray filters do not overlap the table', async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'clinical-layout-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const workspace = path.join(repositoryRoot, 'packages/apps/esm-patient-imaging-app');
  const config = loadConfig(workspace, 'rspack.config.js');
  const outputPath = path.join(fixture, 'dist');
  await writeFile(
    path.join(fixture, 'entry.js'),
    `import imaging from ${JSON.stringify(path.join(workspace, 'src/imaging/studies/study-form.scss'))};
import tray from ${JSON.stringify(path.join(repositoryRoot, 'packages/apps/esm-interconsultas-app/src/dashboard/interconsultas-table.scss'))};
import laboratory from ${JSON.stringify(path.join(repositoryRoot, 'packages/apps/esm-laboratory-app/src/components/orders-table/orders-data-table.scss'))};
window.clinicalStyles = { imaging, tray, laboratory };`,
  );
  await compile(
    {
      context: workspace,
      mode: config.mode,
      entry: path.join(fixture, 'entry.js'),
      output: { ...config.output, path: outputPath, filename: 'styles.js', publicPath: '' },
      module: config.module,
      resolve: config.resolve,
      optimization: config.optimization,
      plugins: config.plugins.filter((plugin) => plugin instanceof rspack.CssExtractRspackPlugin),
      devtool: false,
      performance: false,
    },
    rspack,
  );
  const context = await browser.newContext({ offline: true });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.setContent(
    '<main id="workspace"><form id="form"><div id="content" class="cds--stack-vertical cds--stack-scale-6">' +
      '<section id="server" style="height:64px">Servidor de imágenes</section>' +
      '<section id="files"><p>Selecciona archivos DICOM</p></section></div>' +
      '<div id="buttons" class="cds--btn-set"><button class="cds--btn cds--btn--secondary">Cancelar</button>' +
      '<button class="cds--btn cds--btn--primary">Subir</button></div></form></main>' +
      '<section id="tray" class="cds--data-table-container"><section class="cds--table-toolbar"><div id="toolbar" class="cds--toolbar-content">' +
      '<div id="filters"><div><label>Servicio destino</label><select><option>Todos</option></select></div>' +
      '<div><label>UPSS de origen</label><select><option>Todos</option></select></div></div>' +
      '<div id="search"><input aria-label="Buscar"><button>Limpiar filtros</button></div></div></section>' +
      '<p id="results">Resultados: 0 de 0</p><div id="scroll"><table id="table"><thead>' +
      '<tr><th>Fecha solicitud</th><th>Paciente</th></tr></thead></table></div></section>',
  );
  await page.addStyleTag({ path: require.resolve('@carbon/styles/css/styles.css') });
  const sharedStyles = await configRequire('sass-embedded').compileAsync(
    path.join(repositoryRoot, 'packages/libs/esm-styleguide/src/_overrides.scss'),
    { loadPaths: [path.join(repositoryRoot, 'node_modules')] },
  );
  await page.addStyleTag({ content: sharedStyles.css });
  for (const asset of (await readdir(outputPath)).filter((file) => file.endsWith('.css'))) {
    await page.addStyleTag({ path: path.join(outputPath, asset) });
  }
  await page.addScriptTag({ path: path.join(outputPath, 'styles.js') });
  await page.addStyleTag({
    content:
      'body{margin:0}#workspace{height:500px}#filters label{display:block}#filters select{height:48px;width:100%}#search input{height:48px}',
  });
  await page.evaluate(() => {
    const { imaging, tray } = window.clinicalStyles;
    for (const [id, key] of Object.entries({ form: 'form', content: 'formContent', buttons: 'buttonSet' })) {
      document.getElementById(id).classList.add(imaging[key]);
    }
    document.querySelectorAll('#buttons button').forEach((button) => {
      button.classList.add(imaging.button);
    });
    for (const [id, key] of Object.entries({
      tray: 'tableContainer',
      toolbar: 'tableToolbar',
      filters: 'filterGroup',
      search: 'searchGroup',
      results: 'resultCount',
      scroll: 'tableScroll',
      table: 'table',
    })) {
      document.getElementById(id).classList.add(tray[key]);
    }
  });
  for (const width of [320, 420, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('#files').evaluate((files) => {
      files.style.height = '';
    });
    const server = await page.locator('#server').boundingBox();
    const files = await page.locator('#files').boundingBox();
    assert.ok(files.y - (server.y + server.height) <= 24, `form fields stay together at ${width}px`);
    const actions = await page.locator('#buttons').boundingBox();
    assert.ok(actions.y + actions.height <= 500, `actions fit at ${width}px`);
    await page.locator('#files').evaluate((files) => {
      files.style.height = '1200px';
    });
    await page.locator('#content').evaluate((content) => {
      content.scrollTop = content.scrollHeight;
    });
    assert.ok(await page.locator('#content').evaluate((content) => content.scrollTop > 0));
    assert.deepEqual(await page.locator('#buttons').boundingBox(), actions, 'scrolling does not move actions');
    const toolbar = await page.locator('#toolbar').boundingBox();
    const results = await page.locator('#results').boundingBox();
    const table = await page.locator('#table').boundingBox();
    assert.ok(toolbar.y + toolbar.height <= results.y, `filters do not overlap results at ${width}px`);
    assert.ok(results.y + results.height <= table.y, `results do not overlap table at ${width}px`);
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'only the table scrolls horizontally',
    );
  }

  // Use Carbon's actual markup: its toolbar sizing and dropdown minimums are
  // part of the regression, including when a sidebar leaves a narrow container.
  const { createElement: h } = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const {
    Button,
    Dropdown,
    Layer,
    Search,
    TableContainer,
    TableToolbar,
    TableToolbarContent,
  } = require('@carbon/react');
  const markup = renderToStaticMarkup(
    h(
      TableContainer,
      { id: 'laboratory' },
      h(
        TableToolbar,
        null,
        h(
          TableToolbarContent,
          { id: 'lab-toolbar' },
          h(
            Layer,
            { id: 'lab-filters' },
            ...['Estado', 'Prioridad', 'Grupo de laboratorio', 'Indicaciones'].map((label, index) =>
              h(Dropdown, {
                key: label,
                id: `lab-filter-${index}`,
                titleText: label,
                label: 'Todos',
                items: ['Todos'],
              }),
            ),
            h(
              'div',
              null,
              h('label', { htmlFor: 'lab-dates' }, 'Rango de fechas'),
              h('input', {
                id: 'lab-dates',
                value: '29/09/2026 – 30/09/2026',
                readOnly: true,
                style: { width: '100%' },
              }),
            ),
          ),
          h(
            Layer,
            { id: 'lab-search' },
            h(Search, { id: 'lab-search-input', labelText: 'Buscar en esta lista', size: 'sm' }),
            h(Button, { kind: 'tertiary', size: 'sm' }, 'Descargar reporte de exámenes completados'),
          ),
        ),
      ),
      h(
        'div',
        { className: 'cds--data-table-content', id: 'lab-results' },
        h(
          'table',
          { className: 'cds--data-table', style: { minWidth: '68rem' } },
          h('thead', null, h('tr', null, h('th', null, 'Paciente sintético'))),
        ),
      ),
    ),
  );
  await page.evaluate((html) => {
    document.getElementById('workspace').remove();
    document.getElementById('tray').remove();
    document.body.insertAdjacentHTML('beforeend', html);
    const styles = window.clinicalStyles.laboratory;
    for (const [id, key] of Object.entries({
      laboratory: 'tableContainer',
      'lab-toolbar': 'tableToolBar',
      'lab-filters': 'filterGroup',
      'lab-search': 'searchGroup',
    })) {
      document.getElementById(id).classList.add(styles[key]);
    }
  }, markup);
  for (const viewport of [320, 768, 1440]) {
    await page.setViewportSize({ width: viewport, height: 900 });
    for (const width of [Math.min(320, viewport), viewport]) {
      await page.locator('#laboratory').evaluate((element, width) => {
        element.style.width = `${width}px`;
      }, width);
      const toolbar = await page.locator('#lab-toolbar').boundingBox();
      const results = await page.locator('#lab-results').boundingBox();
      assert.ok(
        toolbar.y + toolbar.height <= results.y,
        `laboratory filters stay above table at ${width}/${viewport}px`,
      );
      const controls = await page.locator('#lab-filters > *, #lab-search > *').evaluateAll((elements) =>
        elements.map((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        }),
      );
      for (const [index, control] of controls.entries()) {
        assert.ok(control.width >= 150, `laboratory control ${index} does not collapse at ${width}/${viewport}px`);
        assert.ok(control.x >= 0 && control.x + control.width <= width, 'controls fit inside the tray');
        assert.ok(control.y + control.height <= results.y, 'controls fit above the table');
        for (const other of controls.slice(index + 1)) {
          assert.ok(
            control.x + control.width <= other.x ||
              other.x + other.width <= control.x ||
              control.y + control.height <= other.y ||
              other.y + other.height <= control.y,
            'controls do not overlap',
          );
        }
      }
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        'only the lab table scrolls horizontally',
      );
    }
  }
});

test('visit date and time fit the workspace and keep validation readable', async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'visit-date-time-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const workspace = path.join(repositoryRoot, 'packages/apps/esm-patient-chart-app');
  const config = loadConfig(workspace, 'rspack.config.js');
  const outputPath = path.join(fixture, 'dist');
  await writeFile(
    path.join(fixture, 'entry.js'),
    `import styles from ${JSON.stringify(path.join(workspace, 'src/visit/visit-form/visit-form.scss'))};
window.visitStyles = styles;`,
  );
  await compile(
    {
      context: workspace,
      mode: config.mode,
      entry: path.join(fixture, 'entry.js'),
      output: {
        ...config.output,
        path: outputPath,
        filename: 'styles.js',
        publicPath: '',
      },
      module: config.module,
      resolve: config.resolve,
      optimization: config.optimization,
      plugins: config.plugins.filter((plugin) => plugin instanceof rspack.CssExtractRspackPlugin),
      devtool: false,
      performance: false,
    },
    rspack,
  );
  const context = await browser.newContext({ offline: true });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.setContent('<main id="fixture"></main>');
  await page.addStyleTag({
    path: require.resolve('@carbon/styles/css/styles.css'),
  });
  for (const asset of (await readdir(outputPath)).filter((file) => file.endsWith('.css'))) {
    await page.addStyleTag({ path: path.join(outputPath, asset) });
  }
  await page.addScriptTag({ path: path.join(outputPath, 'styles.js') });
  const styles = await page.evaluate(() => window.visitStyles);
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { DatePicker, DatePickerInput, TimePicker, TimePickerSelect, SelectItem } = require('@carbon/react');
  const element = React.createElement;
  const error = 'Enter a valid time in hh:mm format (01:00 to 12:59)';
  const markup = renderToStaticMarkup(
    element(
      'div',
      { className: styles.container },
      element(
        'section',
        { className: styles.dateTimeField },
        element('h1', { className: styles.sectionTitle }, 'Fecha y hora de inicio de consulta'),
        element(
          'div',
          { className: styles.dateTimeSection + ' ' + styles.sectionField },
          element(
            DatePicker,
            { className: styles.datePicker, datePickerType: 'single' },
            element(DatePickerInput, {
              id: 'date',
              labelText: 'Fecha *',
              placeholder: 'dd/mm/yyyy',
              style: { inlineSize: '100%' },
            }),
          ),
          element(
            'div',
            { className: styles.timePickerContainer },
            element(
              TimePicker,
              {
                className: styles.timePicker,
                id: 'time',
                labelText: 'Hora *',
                invalid: true,
                invalidText: error,
              },
              element(
                TimePickerSelect,
                { id: 'period', 'aria-label': 'AM/PM' },
                element(SelectItem, { value: 'AM', text: 'AM' }),
                element(SelectItem, { value: 'PM', text: 'PM' }),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await page.locator('#fixture').evaluate((node, html) => {
    node.innerHTML = html;
  }, markup);
  for (const [viewport, width, tablet] of [
    [1280, 280, false],
    [1280, 460, false],
    [768, 620, true],
  ]) {
    await page.setViewportSize({ width: viewport, height: 800 });
    await page.locator('#fixture').evaluate(
      (node, state) => {
        node.style.width = state.width + 'px';
        node.className = state.tablet ? 'omrs-breakpoint-lt-desktop' : '';
      },
      { width, tablet },
    );
    const date = await page.locator('#date').boundingBox();
    const time = await page.locator('#time').boundingBox();
    const period = await page.locator('#period').boundingBox();
    if (width === 280) assert.ok(time.y >= date.y + date.height + 16, 'narrow workspace stacks fields');
    else {
      assert.ok(Math.abs(date.y - time.y) < 1, 'date and time inputs align');
      assert.ok(time.x >= date.x + date.width + 16, 'fields have a clear gap');
    }
    assert.ok(Math.abs(time.y - period.y) < 1, 'AM/PM aligns with the time input');
    assert.ok(
      await page.locator('#fixture').evaluate((node) => node.scrollWidth <= node.clientWidth),
      'no horizontal overflow',
    );
    const message = page.getByText(error, { exact: true });
    await expect(message).toBeVisible();
    const box = await message.boundingBox();
    assert.ok(box.height > 0 && box.width > 100, 'time validation is not clipped or squeezed');
  }
});

test('chart dashboards preserve results spacing and contain wide tables at mobile widths', async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'results-dashboard-spacing-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const workspace = path.join(repositoryRoot, 'packages/apps/esm-patient-chart-app');
  const config = loadConfig(workspace, 'rspack.config.js');
  const outputPath = path.join(fixture, 'dist');
  await writeFile(
    path.join(fixture, 'entry.js'),
    `import chart from ${JSON.stringify(path.join(workspace, 'src/patient-chart/chart-review/dashboard-view.scss'))};
import ${JSON.stringify(path.join(repositoryRoot, 'packages/libs/esm-patient-common-lib/src/tabbed-dashboard/tabbed-dashboard.scss'))};
window.chartStyles = chart;`,
  );
  await compile(
    {
      context: workspace,
      mode: config.mode,
      entry: path.join(fixture, 'entry.js'),
      output: { ...config.output, path: outputPath, filename: 'styles.js', publicPath: '' },
      module: config.module,
      resolve: config.resolve,
      optimization: config.optimization,
      plugins: config.plugins.filter((plugin) => plugin instanceof rspack.CssExtractRspackPlugin),
      devtool: false,
      performance: false,
    },
    rspack,
  );
  const context = await browser.newContext({ offline: true });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.setContent(
    '<div data-extension-slot-name="patient-chart-test-results-dashboard-slot" id="results"></div>' +
      '<div data-extension-slot-name="patient-chart-encounters-dashboard-slot" id="encounters"></div>' +
      '<main id="host"><div id="dashboard"><div id="extension"><div id="wrapper"><div>' +
      '<section class="cds--data-table-container"><div id="table-scroll" class="cds--data-table-content">' +
      '<table class="cds--data-table"><thead><tr>' +
      Array.from({ length: 9 }, (_, index) => `<th>Control prenatal ${index + 1}: fecha de atención</th>`).join('') +
      '</tr></thead><tbody><tr>' +
      Array.from({ length: 9 }, () => '<td>01/10/2026</td>').join('') +
      '</tr></tbody></table></div></section></div></div></div></div></main>',
  );
  await page.addStyleTag({ path: require.resolve('@carbon/styles/css/styles.css') });
  for (const asset of (await readdir(outputPath)).filter((file) => file.endsWith('.css'))) {
    await page.addStyleTag({ path: path.join(outputPath, asset) });
  }
  await page.addScriptTag({ path: path.join(outputPath, 'styles.js') });
  await page.addStyleTag({ content: 'body{margin:0}#host{overflow-x:auto}' });
  await page.evaluate(() => {
    document.getElementById('results').className = window.chartStyles.dashboard;
    document.getElementById('encounters').className = window.chartStyles.dashboard;
    for (const [id, name] of Object.entries({
      host: 'dashboardContainer',
      dashboard: 'dashboard',
      extension: 'extension',
      wrapper: 'extensionWrapper',
    })) {
      document.getElementById(id).className = window.chartStyles[name];
    }
  });
  await expect(page.locator('#results')).toHaveCSS('margin-top', '16px');
  await expect(page.locator('#encounters')).toHaveCSS('margin-top', '0px');

  for (const width of [1280, 768, 420, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate((mobile) => {
      document.body.classList.toggle('omrs-breakpoint-lt-tablet', mobile);
    }, width < 672);
    assert.ok(
      await page.locator('#host').evaluate((host) => host.scrollWidth <= host.clientWidth),
      `the chart host stays within its own width at ${width}px`,
    );
    assert.ok(
      await page.locator('#extension').evaluate((extension) => {
        const parent = extension.parentElement.getBoundingClientRect();
        return extension.getBoundingClientRect().right <= parent.right + 1;
      }),
      `the extension stays within its dashboard at ${width}px`,
    );
    if (width < 672) {
      assert.ok(
        await page.locator('#table-scroll').evaluate((content) => {
          content.scrollLeft = content.scrollWidth;
          return content.scrollWidth > content.clientWidth && content.scrollLeft > 0;
        }),
        'all table columns remain accessible through the table’s own horizontal scroll',
      );
    }
  }
});

test('workspace rail reserves desktop chart space without changing overlay or tablet layout', async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'workspace-rail-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const workspace = path.join(repositoryRoot, 'packages/libs/esm-styleguide');
  const config = loadConfig(workspace, 'rspack.config.cjs');
  const outputPath = path.join(fixture, 'dist');
  const source = (file) => JSON.stringify(path.join(workspace, 'src', file));
  await writeFile(
    path.join(fixture, 'entry.js'),
    [
      `import ${source('components/_general.scss')};`,
      `import menu from ${source('workspaces2/workspace-windows-and-menu.module.scss')};`,
      `import rail from ${source('workspaces2/action-menu2/action-menu2.module.scss')};`,
      `import windows from ${source('workspaces2/workspace2.module.scss')};`,
      'window.layoutStyles = { menu, rail, windows };',
    ].join('\n'),
  );
  await compile(
    {
      context: workspace,
      mode: config.mode,
      entry: path.join(fixture, 'entry.js'),
      output: {
        ...config.output,
        path: outputPath,
        filename: 'styles.js',
        publicPath: '',
      },
      module: config.module,
      resolve: config.resolve,
      optimization: config.optimization,
      plugins: config.plugins.filter((plugin) => plugin instanceof rspack.CssExtractRspackPlugin),
      devtool: false,
      performance: false,
    },
    rspack,
  );
  const context = await browser.newContext({ offline: true });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.setContent(
    '<div id="omrs-top-nav-app-container"></div><div id="omrs-left-nav-container"></div>' +
      '<div id="omrs-workspaces-container"><div id="menu"><div id="windows"></div>' +
      '<aside id="rail"><div id="sideRail"><div id="actions"><button>Forms</button></div></div></aside></div></div>' +
      '<div id="omrs-apps-container"><main><header>Test chart</header><section>Chart content</section></main></div>',
  );
  for (const asset of (await readdir(outputPath)).filter((file) => file.endsWith('.css'))) {
    await page.addStyleTag({ path: path.join(outputPath, asset) });
  }
  await page.addScriptTag({ path: path.join(outputPath, 'styles.js') });
  await page.addStyleTag({
    content: 'body{margin:0;--omrs-navbar-height:48px}*{box-sizing:border-box}main{min-height:1200px}',
  });
  await page.evaluate(() => {
    const { menu, rail } = window.layoutStyles;
    document.querySelector('#menu').className = menu.workspaceWindowsAndMenuContainer;
    document.querySelector('#windows').className = menu.workspaceWindowsContainer;
    document.querySelector('#rail').className = rail.sideRailVisible;
    document.querySelector('#sideRail').className = rail.sideRail;
    document.querySelector('#actions').className = rail.container;
  });
  for (const [width, height] of [
    [1920, 1080],
    [1366, 768],
  ]) {
    await page.setViewportSize({ width, height });
    for (const direction of ['ltr', 'rtl']) {
      await page.evaluate((dir) => {
        document.documentElement.dir = dir;
        document.body.className = 'omrs-breakpoint-gt-tablet';
      }, direction);
      const app = await page.locator('#omrs-apps-container').boundingBox();
      const rail = await page.locator('#rail').boundingBox();
      assert.equal(rail.width, 48);
      assert.equal(app.width, width - rail.width, `${width} ${direction}: chart must reserve the rail`);
      assert.ok(direction === 'ltr' ? app.x + app.width <= rail.x : rail.x + rail.width <= app.x);
      await page.evaluate(() => {
        const { windows } = window.layoutStyles;
        document.querySelector('#windows').innerHTML =
          `<div class="${windows.workspaceOuterContainer} ${windows.narrowWorkspace}"><div class="${windows.workspaceSpacer}"></div></div>`;
      });
      assert.equal((await page.locator('#omrs-apps-container').boundingBox()).width, width - 48 - 420);
      await page.evaluate(() => {
        document.querySelector('#windows').replaceChildren();
      });
    }
    await page.evaluate(() => {
      document.querySelector('#rail').className = window.layoutStyles.rail.sideRailHidden;
    });
    assert.equal((await page.locator('#omrs-apps-container').boundingBox()).width, width);
    await page.evaluate(() => {
      document.querySelector('#rail').className = window.layoutStyles.rail.sideRailVisible;
      document.querySelector('#menu').classList.add(window.layoutStyles.menu.overlay);
    });
    assert.equal((await page.locator('#omrs-apps-container').boundingBox()).width, width);
    await page.evaluate(() => {
      document.querySelector('#menu').classList.remove(window.layoutStyles.menu.overlay);
    });
  }
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.evaluate(() => {
    document.body.className = 'omrs-breakpoint-lt-desktop';
  });
  assert.equal((await page.locator('#omrs-apps-container').boundingBox()).width, 768);
  await expect(page.locator('#sideRail')).toHaveCSS('position', 'fixed');
  const bottomRail = await page.locator('#sideRail').boundingBox();
  assert.equal(bottomRail.y + bottomRail.height, 1024);
});

test('mobile workspace actions stay above the intrinsic action menu when labels wrap or change', async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'mobile-workspace-menu-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const workspace = path.join(repositoryRoot, 'packages/libs/esm-styleguide');
  const config = loadConfig(workspace, 'rspack.config.cjs');
  const outputPath = path.join(fixture, 'dist');
  const source = (file) => JSON.stringify(path.join(workspace, 'src', file));
  const stubs = path.join(fixture, 'context.jsx');
  const windowFixture = path.join(fixture, 'window.jsx');
  await writeFile(
    stubs,
    `import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ActionMenuButton2 } from ${source('workspaces2/action-menu2/action-menu-button2.component')};
export const ComponentContext = React.createContext({});
export const WorkspaceContext = React.createContext({});
export const useWorkspace2Context = () => React.useContext(WorkspaceContext);
export const isDesktop = layout => layout === 'small-desktop';
export function useLayoutType() {
  const read = () => innerWidth >= 1024 ? 'small-desktop' : 'phone';
  const [layout, setLayout] = useState(read);
  useEffect(() => { const update = () => setLayout(read()); addEventListener('resize', update);
    return () => removeEventListener('resize', update); }, []);
  return layout;
}
export const useSession = () => ({ user: {} });
export const userHasAccess = () => true;
export const subscribeOpenmrsEvent = () => () => {};
export const getCoreTranslation = key => key;
export const CloseIcon = () => null;
export const ArrowRightIcon = () => null;
export const closeWorkspaceGroup2 = () => {};
export const launchWorkspace2 = () => {};
const listeners = new Set();
const group = { name: 'test-group', moduleName: 'test-app', overlay: false };
let state = {
  openedGroup: { groupName: group.name, props: {} },
  openedWindows: [{ windowName: 'test-window', openedWorkspaces: [{ workspaceName: 'test-workspace', uuid: 'test' }] }],
  registeredGroupsByName: { [group.name]: group },
  registeredWindowsByName: { 'test-window': { name: 'test-window', group: group.name, icon: () => null } },
  registeredWorkspacesByName: { 'test-workspace': { window: 'test-window' } },
  workspaceTitleByWorkspaceName: { 'test-workspace': 'Antecedentes' },
  setWorkspaceTitle() {}, setHasUnsavedChanges() {}, setWindowMaximized() {}, hideWindow() {},
};
export const useWorkspace2Store = () => useSyncExternalStore(
  listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => state);
export function updateFixture(options) {
  const groupName = options.groupName ?? state.openedGroup.groupName;
  state = { ...state,
    openedGroup: { groupName, props: {} },
    registeredGroupsByName: { [groupName]: { ...group, name: groupName, overlay: options.overlay ?? false } },
    openedWindows: [{ ...state.openedWindows[0], maximized: options.maximized ?? false,
      props: { isRootWorkspace: options.root !== false } }],
    registeredWindowsByName: { 'test-window': { ...state.registeredWindowsByName['test-window'],
      group: groupName, showActionMenu: options.menu !== false } },
  };
  listeners.forEach(listener => listener());
}
export function ExtensionSlot() {
  return <>{['Signos vitales', 'Formularios de evaluación clínica, antecedentes y seguimiento de la consulta', 'Citas', 'Órdenes', 'Lista de tareas'].map(label =>
    <div key={label}><ActionMenuButton2 label={label} icon={() => <svg width="16" height="16" />}
      workspaceToLaunch={{ workspaceName: 'test-workspace' }} /></div>)}</>;
}`,
  );
  await writeFile(
    windowFixture,
    `import React from 'react';
import { Button, ButtonSet } from '@carbon/react';
import { Workspace2 } from ${source('workspaces2/workspace2.component')};
import { WorkspaceContext } from './context.jsx';
import form from ${JSON.stringify(path.join(repositoryRoot, 'packages/apps/esm-patient-conditions-app/src/conditions/conditions-form.scss'))};
export default function Window({ showActionMenu, openedWindow }) {
  return <WorkspaceContext.Provider value={{ workspaceName: 'test-workspace',
    isRootWorkspace: openedWindow.props?.isRootWorkspace !== false, showActionMenu }}>
    <Workspace2 title="Antecedentes"><form className={form.form} onSubmit={event => {
      event.preventDefault(); window.saved = (window.saved ?? 0) + 1;
    }}><div className={form.formContent} id="fields"><div style={{height:1200}}>Campos del antecedente</div></div>
      <footer className={form.formActions}><ButtonSet>
        <Button kind="secondary" className={form.button}>Cancelar</Button>
        <Button type="submit" className={form.button}>Guardar y cerrar</Button>
      </ButtonSet></footer>
    </form></Workspace2>
  </WorkspaceContext.Provider>;
}`,
  );
  await writeFile(
    path.join(fixture, 'entry.js'),
    `import ${source('components/_general.scss')};
import { renderWorkspaceWindowsAndMenu } from ${source('workspaces2/workspace-windows-and-menu.component')};
import { updateFixture } from './context.jsx';
window.updateFixture = updateFixture;
renderWorkspaceWindowsAndMenu(document.getElementById('omrs-workspaces-container'));`,
  );
  await compile(
    {
      context: workspace,
      mode: config.mode,
      entry: path.join(fixture, 'entry.js'),
      output: {
        ...config.output,
        path: outputPath,
        filename: 'fixture.js',
        publicPath: '',
      },
      module: {
        rules: config.module.rules.map((rule) => ({
          ...rule,
          use: Array.isArray(rule.use)
            ? rule.use.map((loader) =>
                loader.loader === 'css-loader'
                  ? {
                      ...loader,
                      options: {
                        ...loader.options,
                        modules: {
                          ...loader.options.modules,
                          auto: (resource) => /\.module\.scss$|conditions-form\.scss$/.test(resource),
                        },
                      },
                    }
                  : loader,
              )
            : rule.use,
        })),
      },
      resolve: {
        ...config.resolve,
        modules: [path.join(repositoryRoot, 'node_modules'), 'node_modules'],
        alias: {
          '@openmrs/esm-react-utils$': stubs,
          '@openmrs/esm-api$': stubs,
          '@openmrs/esm-emr-api$': stubs,
          '@openmrs/esm-translations$': stubs,
          './workspace2$': stubs,
          '../workspace2$': stubs,
          '../icons$': stubs,
          '../../icons$': stubs,
          './active-workspace-window.component$': windowFixture,
        },
      },
      optimization: config.optimization,
      plugins: config.plugins.filter((plugin) => plugin instanceof rspack.CssExtractRspackPlugin),
      devtool: false,
      performance: false,
    },
    rspack,
  );
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 420, height: 1000 },
  });
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setContent(
    '<div id="omrs-top-nav-app-container"></div><div id="omrs-left-nav-container"></div>' +
      '<div id="omrs-workspaces-container"></div><div id="omrs-apps-container"></div>',
  );
  await page.addStyleTag({
    path: require.resolve('@carbon/styles/css/styles.css'),
  });
  for (const asset of (await readdir(outputPath)).filter((file) => file.endsWith('.css'))) {
    await page.addStyleTag({ path: path.join(outputPath, asset) });
  }
  await page.addStyleTag({
    content: 'body{margin:0;--omrs-navbar-height:48px}*{box-sizing:border-box}',
  });
  await page.evaluate(() => {
    document.body.className = 'omrs-breakpoint-lt-desktop';
  });
  const originalBottomNavHeight = await page
    .locator('html')
    .evaluate((node) => getComputedStyle(node).getPropertyValue('--bottom-nav-height'));
  await page.addScriptTag({ path: path.join(outputPath, 'fixture.js') });
  const save = page.getByRole('button', { name: 'Guardar y cerrar' });
  const rail = page.locator('aside > div');
  const assertAccessible = async (description) => {
    await expect(save).toBeInViewport({ ratio: 1 });
    await expect(async () => {
      const actions = await save.boundingBox();
      const menu = await rail.boundingBox();
      assert.ok(actions.y + actions.height <= menu.y + 1, `${description}: ${JSON.stringify({ actions, menu })}`);
    }).toPass({ timeout: 5000 });
    await save.click();
  };
  await expect(async () => {
    const box = await rail.boundingBox();
    assert.ok(box.height >= 118, `wrapped menu height: ${box.height}`);
  }).toPass({ timeout: 5000 });
  await assertAccessible('save stays above wrapped menu');
  await page.locator('#fields').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await assertAccessible('scrolling fields preserves accessible actions');
  for (const options of [{ overlay: true }, { maximized: true }, { root: false }]) {
    await page.evaluate((options) => window.updateFixture(options), options);
    await assertAccessible('overlay, maximized and child workspaces reserve the actual menu');
  }
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
    window.updateFixture({});
  });
  await assertAccessible('RTL preserves accessible actions');
  const initialHeight = (await rail.boundingBox()).height;
  await page
    .getByRole('button', {
      name: 'Formularios de evaluación clínica, antecedentes y seguimiento de la consulta',
      exact: true,
    })
    .locator('span')
    .last()
    .evaluate((node) => {
      node.textContent += ' y seguimiento de las tareas pendientes para el cierre de la consulta';
    });
  await expect(async () => assert.ok((await rail.boundingBox()).height > initialHeight)).toPass({ timeout: 5000 });
  await assertAccessible('dynamic labels update the reservation');
  await page.evaluate(() => window.updateFixture({ menu: false, groupName: 'second-group' }));
  await expect(rail).toHaveCount(0);
  await expect(page.locator('#omrs-workspaces-container > div')).toHaveCSS('--bottom-nav-height', '0px');
  await save.click();
  await page.evaluate(() => window.updateFixture({}));
  await assertAccessible('reopening the menu restores its measured height');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    document.body.className = 'omrs-breakpoint-gt-tablet';
  });
  await expect(page.locator('#omrs-workspaces-container > div')).toHaveCSS('--bottom-nav-height', '0px');
  await expect(rail).toHaveCSS('position', 'static');
  await save.click();
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => {
      document.body.className = 'omrs-breakpoint-lt-desktop';
    });
    await assertAccessible('returning from desktop remeasures mobile and tablet menus');
  }
  assert.equal(await page.evaluate(() => window.saved), 12, 'all saves use ordinary pointer clicks');
  await expect(page.locator('html')).toHaveCSS('--bottom-nav-height', originalBottomNavHeight);
  assert.deepEqual(pageErrors, []);
});

before(async () => {
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
});

function loadConfig(workspace, configFile) {
  const originalDirectory = process.cwd();
  try {
    // The shared factory reads the consuming app's manifest and routes from cwd.
    process.chdir(workspace);
    return require(path.join(workspace, configFile))({}, { mode: 'production' });
  } finally {
    process.chdir(originalDirectory);
  }
}

async function compile(config, compilerFactory) {
  const compiler = compilerFactory(config);
  try {
    const stats = await new Promise((resolve, reject) => {
      compiler.run((error, result) => (error ? reject(error) : resolve(result)));
    });
    assert.ok(stats, 'The compiler must return compilation results');
    assert.equal(stats.hasErrors(), false, stats.toString({ all: false, errors: true }));
    return stats;
  } finally {
    await new Promise((resolve, reject) => {
      compiler.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function writeFixture(directory, extractCss) {
  // Apps scope ordinary .scss files; the styleguide and app shell scope .module.*.
  const suffix = extractCss ? '.module' : '';
  const files = {
    ['primary' + suffix + '.scss']: [
      '$spacing: 13px;',
      '.panel { padding: $spacing; > .action { color: rgb(12, 34, 56); } }',
      '.icon-label { margin-left: 11px; }',
      ':global(.style-contract-global) { border-top: 3px solid rgb(65, 43, 21); }',
    ].join('\n'),
    ['secondary' + suffix + '.scss']: '.panel { padding: 29px; }',
    ['plain' + suffix + '.css']: '.plain-css { letter-spacing: 3px; }',
    'entry.js': [
      "import primary from './primary" + suffix + ".scss';",
      "import secondary from './secondary" + suffix + ".scss';",
      "import plain from './plain" + suffix + ".css';",
      "document.getElementById('primary').className = primary.panel;",
      "document.getElementById('action').className = primary.action;",
      "document.getElementById('label').className = primary.iconLabel;",
      "document.getElementById('original-label').className = primary['icon-label'];",
      "document.getElementById('secondary').className = secondary.panel;",
      "document.getElementById('plain').className = plain.plainCss;",
      "document.getElementById('original-plain').className = plain['plain-css'];",
    ].join('\n'),
  };
  if (extractCss) {
    files['global.scss'] = '.style-contract-base { line-height: 23px; }';
    files['global.css'] = '.style-contract-plain-global { padding-bottom: 17px; }';
    files['openmrs-esm-styleguide.css'] = '.style-contract-framework { margin-bottom: 19px; }';
    files['entry.js'] =
      "import './global.scss';\nimport './global.css';\nimport './openmrs-esm-styleguide.css';\n" + files['entry.js'];
  }
  await Promise.all(Object.entries(files).map(([name, source]) => writeFile(path.join(directory, name), source)));
}

for (const owner of styleOwners) {
  test(owner.directory + ' preserves CSS/SCSS imports, scoping and rendered styles', { timeout: 30_000 }, async (t) => {
    const fixture = await mkdtemp(path.join(tmpdir(), 'sihsalus-style-contract-'));
    t.after(() => rm(fixture, { recursive: true, force: true }));
    const workspace = owner.appShell
      ? getAppShellPackageRoot()
      : path.join(repositoryRoot, 'packages', owner.directory);
    const config = owner.appShell ? getAppShellWebpackConfig() : loadConfig(workspace, owner.configFile);
    const outputPath = path.join(fixture, 'dist');
    await writeFixture(fixture, owner.extractCss);

    // Exercise the actual loader rules and minimizers, with a small DOM fixture
    // instead of the app's entry points and Module Federation container.
    const stats = await compile(
      {
        context: workspace,
        mode: config.mode,
        entry: path.join(fixture, 'entry.js'),
        output: {
          ...config.output,
          path: outputPath,
          filename: 'styles.js',
          publicPath: '',
        },
        module: config.module,
        resolve: config.resolve,
        optimization: config.optimization,
        plugins: config.plugins.filter(
          (plugin) => plugin instanceof rspack.CssExtractRspackPlugin || plugin instanceof MiniCssExtractPlugin,
        ),
        devtool: false,
        performance: false,
      },
      owner.appShell ? webpack : rspack,
    );

    const context = await browser.newContext({ offline: true });
    t.after(() => context.close());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setContent(
      '<section id="primary"><button id="action">Style fixture</button></section>' +
        '<span id="label">Label</span><section id="secondary">Second component</section>' +
        '<span id="original-label">Original SCSS name</span><span id="original-plain">Original CSS name</span>' +
        '<span id="plain">CSS fixture</span><div id="unscoped" class="panel">Unscoped</div>' +
        '<div id="global" class="style-contract-global">Global</div>' +
        '<div id="base" class="style-contract-base">Base styles</div>' +
        '<div id="plain-global" class="style-contract-plain-global">Global CSS</div>' +
        '<div id="framework" class="style-contract-framework">Framework CSS</div>',
    );

    const cssAssets = (await readdir(outputPath)).filter((file) => file.endsWith('.css'));
    if (owner.extractCss) {
      assert.ok(cssAssets.length > 0, 'The build must emit a CSS asset');
    }
    for (const asset of cssAssets) {
      await page.addStyleTag({ path: path.join(outputPath, asset) });
    }
    await page.addScriptTag({ path: path.join(outputPath, 'styles.js') });

    assert.deepEqual(errors, [], 'Compiled style imports must not throw in the browser');
    assert.equal(stats.hasWarnings(), false, stats.toString({ all: false, warnings: true }));
    await expect(page.locator('#primary')).toHaveCSS('padding-top', '13px');
    await expect(page.locator('#secondary')).toHaveCSS('padding-top', '29px');
    await expect(page.locator('#action')).toHaveCSS('color', 'rgb(12, 34, 56)');
    await expect(page.locator('#label')).toHaveCSS('margin-left', '11px');
    await expect(page.locator('#original-label')).toHaveCSS('margin-left', '11px');
    await expect(page.locator('#plain')).toHaveCSS('letter-spacing', '3px');
    await expect(page.locator('#original-plain')).toHaveCSS('letter-spacing', '3px');
    assert.equal(
      await page.locator('#label').getAttribute('class'),
      await page.locator('#original-label').getAttribute('class'),
    );
    assert.equal(
      await page.locator('#plain').getAttribute('class'),
      await page.locator('#original-plain').getAttribute('class'),
    );
    await expect(page.locator('#global')).toHaveCSS('border-top-width', '3px');
    await expect(page.locator('#global')).toHaveCSS('border-top-color', 'rgb(65, 43, 21)');
    await expect(page.locator('#unscoped')).toHaveCSS('padding-top', '0px');
    if (owner.extractCss) {
      await expect(page.locator('#base')).toHaveCSS('line-height', '23px');
      await expect(page.locator('#plain-global')).toHaveCSS('padding-bottom', '17px');
      await expect(page.locator('#framework')).toHaveCSS('margin-bottom', '19px');
    }
    assert.notEqual(
      await page.locator('#primary').getAttribute('class'),
      await page.locator('#secondary').getAttribute('class'),
      'Identically named classes in different components must remain isolated',
    );
  });
}

test('clinical form selectors cover the previous workspace and keep their last row and footer reachable', async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'forms-selector-workspace-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const workspace = path.join(repositoryRoot, 'packages/libs/esm-styleguide');
  const config = loadConfig(workspace, 'rspack.config.cjs');
  const outputPath = path.join(fixture, 'dist');
  const source = (file) => JSON.stringify(path.join(workspace, 'src', file));
  const stubs = path.join(fixture, 'context.jsx');
  await writeFile(
    stubs,
    `import React, { useEffect, useState } from 'react';
export { Workspace2 } from ${source('workspaces2/workspace2.component')};
export const WorkspaceContext = React.createContext({});
export const useWorkspace2Context = () => React.useContext(WorkspaceContext);
export const isDesktop = layout => layout === 'small-desktop';
export function useLayoutType() {
  const read = () => innerWidth >= 1024 ? 'small-desktop' : 'phone';
  const [layout, setLayout] = useState(read);
  useEffect(() => { const update = () => setLayout(read()); addEventListener('resize', update);
    return () => removeEventListener('resize', update); }, []);
  return layout;
}
export const getCoreTranslation = key => key;
export const CloseIcon = () => null;
export const ArrowRightIcon = () => null;
export const ArrowLeftIcon = () => null;
export const closeWorkspaceGroup2 = () => {};
export const launchWorkspace = () => {};
export const launchWorkspace2 = () => {};
export const ResponsiveWrapper = ({children}) => <>{children}</>;
export const formatDatetime = () => 'Hoy';
const state = {
  openedGroup: { groupName: 'clinical', props: {} },
  openedWindows: [{ windowName: 'forms', openedWorkspaces: [
    { workspaceName: 'previous', uuid: 'previous' }, { workspaceName: 'selector', uuid: 'selector' }] }],
  registeredGroupsByName: { clinical: { name: 'clinical', persistence: 'closable' } },
  registeredWindowsByName: { forms: { name: 'forms', group: 'clinical' } },
  registeredWorkspacesByName: { previous: { window: 'forms' }, selector: { window: 'forms' } },
  workspaceTitleByWorkspaceName: { previous: 'Previous workspace', selector: 'Clinical forms' },
  setWorkspaceTitle() {}, setHasUnsavedChanges() {}, setWindowMaximized() {}, hideWindow() {},
};
export const useWorkspace2Store = () => state;`,
  );
  await writeFile(
    path.join(fixture, 'entry.jsx'),
    `import React from 'react';
import { createRoot } from 'react-dom/client';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { Workspace2, WorkspaceContext } from './context.jsx';
import ${source('components/_general.scss')};
import menu from ${source('workspaces2/workspace-windows-and-menu.module.scss')};
import Selector from ${JSON.stringify(path.join(repositoryRoot, 'packages/libs/esm-patient-common-lib/src/forms-selector/forms-selector.workspace'))};
const forms = Array.from({length:27}, (_, index) => ({ form: { uuid: 'form-'+index,
  name: index === 26 ? 'Consejería, acuerdos y compromisos' : 'Formulario clínico '+index,
  version:'1', published:true, retired:false, resources:[] }, associatedEncounters: [] }));
const i18n = createInstance();
i18n.use(initReactI18next).init({lng:'es', fallbackLng:false, resources:{es:{translation:{}}}, interpolation:{escapeValue:false}}).then(() => {
createRoot(document.getElementById('fixture')).render(<I18nextProvider i18n={i18n}>
<div className={menu.workspaceWindowsAndMenuContainer}><div className={menu.workspaceWindowsContainer}>
<WorkspaceContext.Provider value={{workspaceName:'previous', isRootWorkspace:true, closeWorkspace:async()=>true, showActionMenu:false}}>
<Workspace2 title="Previous workspace"><label>Previous consultation date<input aria-label="Previous consultation date" type="date" /></label></Workspace2>
</WorkspaceContext.Provider>
<WorkspaceContext.Provider value={{workspaceName:'selector', isRootWorkspace:false, closeWorkspace:async()=>true, showActionMenu:false}}>
<Selector availableForms={forms} patientAge="18 meses" controlNumber={1} title="Clinical forms" patientUuid="synthetic-patient"
closeWorkspace={()=>{}} closeWorkspaceWithSavedChanges={()=>{window.finished=(window.finished??0)+1}}
onFormLaunch={(form, encounter, submitted)=>{(window.opened??=[]).push(form.uuid);submitted()}} />
</WorkspaceContext.Provider>
</div></div></I18nextProvider>);
});`,
  );
  await compile(
    {
      context: workspace,
      mode: config.mode,
      entry: path.join(fixture, 'entry.jsx'),
      output: {
        ...config.output,
        path: outputPath,
        filename: 'fixture.js',
        publicPath: '',
      },
      module: {
        rules: config.module.rules.map((rule) => ({
          ...rule,
          use: Array.isArray(rule.use)
            ? rule.use.map((loader) =>
                loader.loader === 'css-loader'
                  ? {
                      ...loader,
                      options: {
                        ...loader.options,
                        modules: {
                          ...loader.options.modules,
                          auto: (resource) => /\.module\.scss$|forms-(selector|list|table)\.scss$/.test(resource),
                        },
                      },
                    }
                  : loader,
              )
            : rule.use,
        })),
      },
      resolve: {
        ...config.resolve,
        modules: [path.join(repositoryRoot, 'node_modules'), 'node_modules'],
        alias: {
          '@openmrs/esm-framework$': stubs,
          '@openmrs/esm-react-utils$': stubs,
          '@openmrs/esm-translations$': stubs,
          './workspace2$': stubs,
          '../icons$': stubs,
        },
      },
      optimization: config.optimization,
      plugins: config.plugins.filter((plugin) => plugin instanceof rspack.CssExtractRspackPlugin),
      devtool: false,
      performance: false,
    },
    rspack,
  );
  const context = await browser.newContext({ offline: true });
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setContent(
    '<div id="omrs-top-nav-app-container"></div><div id="omrs-left-nav-container"></div><div id="omrs-workspaces-container"><div id="fixture" style="height:100%;position:relative"></div></div><div id="omrs-apps-container"></div>',
  );
  await page.addStyleTag({
    path: require.resolve('@carbon/styles/css/styles.css'),
  });
  for (const asset of (await readdir(outputPath)).filter((file) => file.endsWith('.css'))) {
    await page.addStyleTag({ path: path.join(outputPath, asset) });
  }
  await page.addStyleTag({
    content: 'body{margin:0;--omrs-navbar-height:48px}*{box-sizing:border-box}',
  });
  await page.evaluate(() => {
    document.body.className = 'omrs-breakpoint-gt-tablet';
  });
  await page.addScriptTag({ path: path.join(outputPath, 'fixture.js') });
  for (const width of [1280, 768, 420]) {
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate((width) => {
      document.body.className = width >= 1024 ? 'omrs-breakpoint-gt-tablet' : 'omrs-breakpoint-lt-desktop';
    }, width);
    await expect(page.getByRole('banner', { name: 'workspaceHeader' })).toHaveCount(2);
    const footer = page.getByRole('button', { name: 'Cerrar formularios' });
    await expect
      .poll(() =>
        footer.evaluate((button) => button.closest('form').parentElement.parentElement.getBoundingClientRect().width),
      )
      .toBe(width >= 1024 ? 420 : width);
    await expect(footer).toBeInViewport();
    const before = await footer.boundingBox();
    const last = page.getByRole('button', { name: 'Consejería, acuerdos y compromisos' });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await last.click();
    await last.focus();
    await expect(last).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    assert.deepEqual(await page.evaluate(() => window.opened.slice(-3)), ['form-26', 'form-26', 'form-26']);
    assert.deepEqual(await footer.boundingBox(), before, 'footer stays visible while the forms scroll');
    await footer.focus();
    await page.keyboard.press('Enter');
    const previous = page.getByLabel('Previous consultation date');
    const covered = await previous.evaluate((input) => {
      const box = input.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return !hit || (hit !== input && !input.contains(hit));
    });
    assert.ok(covered, 'opaque native workspace covers previous consultation controls');
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight),
      true,
      'workspace owns scrolling',
    );
  }
  assert.equal(await page.evaluate(() => window.finished), 3, 'footer activation works by keyboard');
  assert.deepEqual(errors, []);
});

test('a saved close refreshes observations across independently bundled microfrontends', async (t) => {
  const { readFile } = require('node:fs/promises');
  const fixture = await mkdtemp(path.join(tmpdir(), 'sihsalus-swr-federation-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const shellConfig = getAppShellWebpackConfig();
  const shellShared = shellConfig.plugins.find((plugin) => plugin._options?.shared)._options.shared;
  const appConfig = loadConfig(
    path.join(repositoryRoot, 'packages/apps/esm-crecimiento-desarrollo-app'),
    'rspack.config.js',
  );
  const appShared = appConfig.plugins.find((plugin) => plugin._options?.shared)._options.shared;
  const shared = (entries) =>
    Object.fromEntries(
      Object.entries(entries).filter(
        ([key]) => key === 'react' || key === 'react-dom' || key === 'swr' || key.startsWith('swr/'),
      ),
    );
  const outputPath = path.join(fixture, 'dist');
  const helper = path.join(repositoryRoot, 'packages/libs/esm-patient-common-lib/src/visit/revalidation-utils.ts');
  const framework = path.join(fixture, 'framework.js');
  await writeFile(
    framework,
    "export const restBaseUrl='/ws/rest/v1'; export const fhirBaseUrl='/ws/fhir2/R4'; export function openmrsFetch(){throw Error('Unexpected clinical request');}",
  );
  await writeFile(
    path.join(fixture, 'host.js'),
    'window.initializeHost = () => { __webpack_public_path__ = "/openmrs/spa/"; return import("./host-bootstrap.js"); };',
  );
  await writeFile(
    path.join(fixture, 'host-bootstrap.js'),
    `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { SWRConfig } from 'swr';
    import { initCache } from 'swr/_internal';
    const cache = new Map(); initCache(cache);
    window.mountReaders = async () => {
      await __webpack_init_sharing__('default');
      for (const name of ['reader', 'saver']) {
        await window[name].init(__webpack_share_scopes__.default);
        const component = (await window[name].get('./start'))().default;
        createRoot(document.getElementById(name)).render(React.createElement(SWRConfig,
          {value:{provider:()=>cache,revalidateOnFocus:false,shouldRetryOnError:false}}, React.createElement(component)));
      }
    };
    window.hostReady = true;
  `,
  );
  await writeFile(
    path.join(fixture, 'reader.js'),
    `
    import React from 'react'; import useSWR from 'swr';
    import useSWRImmutable from 'swr/immutable'; import useSWRInfinite from 'swr/infinite';
    const read = async (key) => {
      window.reads ??= {}; window.reads[key] = (window.reads[key] ?? 0) + 1;
      return window.saved ? ['saved-observation'] : [];
    };
    export default function Reader() {
      const {data} = useSWR('/ws/rest/v1/obs?patient=synthetic-child&concept=stimulation&s=default', read);
      const immutable = useSWRImmutable('/ws/rest/v1/obs?patient=synthetic-child&concept=counseling&s=default', read);
      const other = useSWR('/ws/rest/v1/obs?patient=synthetic-child-other&concept=stimulation&s=default', read);
      const metadata = useSWR('/ws/rest/v1/concept/stimulation', read);
      const pages = useSWRInfinite(index => index < 2 ? '/ws/rest/v1/encounter?patient=synthetic-child&startIndex='+index : null,
        async key => { await read(key); return [window.saved ? 'new-page' : 'old-page']; });
      React.useEffect(()=>{void pages.setSize(2);},[pages.setSize]);
      const output = (label,value) => React.createElement('output', {'aria-label':label,key:label}, value);
      return React.createElement('div', null,
        output('sessions',data ? data.length : 'loading'),
        output('counseling',immutable.data ? immutable.data.length : 'loading'),
        output('other patient',other.data ? other.data.length : 'loading'),
        output('metadata',metadata.data ? metadata.data.length : 'loading'),
        output('history',pages.data?.flat().join(',')));
    }
  `,
  );
  await writeFile(
    path.join(fixture, 'saver.js'),
    `
    import React from 'react'; import {useSWRConfig} from 'swr';
    import {invalidateVisitAndEncounterData} from ${JSON.stringify(helper)};
    export default function Saver() {
      const {mutate,cache}=useSWRConfig();
      return React.createElement('button', {onClick:()=>{
        window.saved=true; invalidateVisitAndEncounterData(mutate,'synthetic-child',cache);
      }}, 'Confirmed synthetic save');
    }
  `,
  );
  await compile(
    {
      mode: 'production',
      context: fixture,
      entry: [path.join(fixture, 'host.js'), ...shellConfig.entry.filter((entry) => entry.endsWith('/swr-runtime.ts'))],
      output: {
        path: outputPath,
        filename: 'host.js',
        publicPath: shellConfig.output.publicPath,
        uniqueName: 'swr-host',
      },
      module: shellConfig.module,
      resolveLoader: { modules: [path.join(repositoryRoot, 'node_modules')] },
      resolve: { modules: [path.join(repositoryRoot, 'node_modules')] },
      plugins: [
        ...shellConfig.plugins.filter((plugin) => plugin.constructor.name === 'InjectManifest'),
        new webpack.container.ModuleFederationPlugin({
          name: 'host',
          shared: shared(shellShared),
        }),
      ],
      devtool: false,
      performance: false,
    },
    webpack,
  );
  for (const name of ['reader', 'saver']) {
    await compile(
      {
        mode: 'production',
        context: fixture,
        entry: {},
        output: {
          path: outputPath,
          filename: `${name}-main.js`,
          publicPath: 'http://swr.test/openmrs/spa/',
          uniqueName: `swr-${name}`,
        },
        module: appConfig.module,
        resolve: {
          ...appConfig.resolve,
          modules: [path.join(repositoryRoot, 'node_modules')],
          alias: { '@openmrs/esm-framework': framework },
        },
        plugins: [
          new rspack.container.ModuleFederationPluginV1({
            name,
            filename: `${name}-remote.js`,
            exposes: { './start': path.join(fixture, `${name}.js`) },
            shared: shared(appShared),
          }),
        ],
        devtool: false,
        performance: false,
      },
      rspack,
    );
  }
  const context = await browser.newContext({ serviceWorkers: 'block' });
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://swr.test' || route.request().method() !== 'GET') return route.abort();
    if (url.pathname === '/openmrs/spa/patient/synthetic-child/chart/WellChildCare')
      return route.fulfill({
        contentType: 'text/html',
        body: '<div id="reader"></div><div id="saver"></div><script src="/openmrs/spa/host.js"></script><script src="/openmrs/spa/reader-remote.js"></script><script src="/openmrs/spa/saver-remote.js"></script><script>window.initializeHost();</script>',
      });
    const filename = path.basename(url.pathname);
    if (url.pathname !== `/openmrs/spa/${filename}`) return route.fulfill({ status: 404, body: '' });
    try {
      return route.fulfill({
        contentType: 'text/javascript',
        body: await readFile(path.join(outputPath, filename)),
      });
    } catch {
      return route.fulfill({ status: 404, body: '' });
    }
  });
  await page.goto('http://swr.test/openmrs/spa/patient/synthetic-child/chart/WellChildCare');
  await page.waitForFunction(() => window.hostReady);
  await page.evaluate(() => window.mountReaders());
  await expect(page.getByLabel('sessions')).toHaveText('0');
  await expect(page.getByLabel('counseling')).toHaveText('0');
  await expect(page.getByLabel('other patient')).toHaveText('0');
  await expect(page.getByLabel('metadata')).toHaveText('0');
  await expect(page.getByLabel('history')).toHaveText('old-page,old-page');
  const before = await page.evaluate(() => window.reads);
  await page.getByRole('button', { name: 'Confirmed synthetic save' }).click();
  await expect(page.getByLabel('sessions')).toHaveText('1');
  await expect(page.getByLabel('counseling')).toHaveText('1');
  await expect(page.getByLabel('history')).toHaveText('new-page,new-page');
  await expect(page.getByLabel('other patient')).toHaveText('0');
  await expect(page.getByLabel('metadata')).toHaveText('0');
  const after = await page.evaluate(() => window.reads);
  for (const key of Object.keys(before).filter(
    (key) => key.includes('synthetic-child-other') || key.includes('/concept/'),
  )) {
    assert.equal(after[key], before[key], `${key} is not revalidated`);
  }
  assert.deepEqual(errors, []);
});
