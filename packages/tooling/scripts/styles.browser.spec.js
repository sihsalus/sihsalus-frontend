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

test('imaging actions remain visible and interconsulta filters do not overlap the table', async (t) => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'clinical-layout-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const workspace = path.join(repositoryRoot, 'packages/apps/esm-patient-imaging-app');
  const config = loadConfig(workspace, 'rspack.config.js');
  const outputPath = path.join(fixture, 'dist');
  await writeFile(
    path.join(fixture, 'entry.js'),
    `import imaging from ${JSON.stringify(path.join(workspace, 'src/imaging/studies/study-form.scss'))};
import tray from ${JSON.stringify(path.join(repositoryRoot, 'packages/apps/esm-interconsultas-app/src/dashboard/interconsultas-table.scss'))};
window.clinicalStyles = { imaging, tray };`,
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
      '<section id="tray"><section class="cds--table-toolbar"><div id="toolbar" class="cds--toolbar-content">' +
      '<div id="filters"><div><label>Servicio destino</label><select><option>Todos</option></select></div>' +
      '<div><label>UPSS de origen</label><select><option>Todos</option></select></div></div>' +
      '<div id="search"><input aria-label="Buscar"><button>Limpiar filtros</button></div></div></section>' +
      '<p id="results">Resultados: 0 de 0</p><div id="scroll"><table id="table"><thead>' +
      '<tr><th>Fecha solicitud</th><th>Paciente</th></tr></thead></table></div></section>',
  );
  await page.addStyleTag({ path: require.resolve('@carbon/styles/css/styles.css') });
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
