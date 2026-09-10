const assert = require('node:assert/strict');
const { mkdtemp, readdir, rm, writeFile } = require('node:fs/promises');
const { createRequire } = require('node:module');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { chromium, expect } = require('@playwright/test');

const repositoryRoot = path.resolve(__dirname, '../../..');
// Resolve the compiler through the workspace that owns the loader dependencies.
const configRequire = createRequire(path.join(repositoryRoot, 'packages/tooling/rspack-config/package.json'));
const { rspack } = configRequire('@rspack/core');

const styleOwners = [
  { directory: 'apps/esm-patient-imaging-app', configFile: 'rspack.config.js' },
  { directory: 'apps/esm-stock-management-app', configFile: 'rspack.config.js' },
  { directory: 'apps/esm-user-onboarding-app', configFile: 'rspack.config.js' },
  { directory: 'libs/esm-styleguide', configFile: 'rspack.config.cjs', extractCss: true },
];

let browser;

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

async function compile(config) {
  const compiler = rspack(config);
  try {
    const stats = await new Promise((resolve, reject) => {
      compiler.run((error, result) => (error ? reject(error) : resolve(result)));
    });
    assert.ok(stats, 'Rspack must return compilation results');
    assert.equal(stats.hasErrors(), false, stats.toString({ all: false, errors: true }));
    assert.equal(stats.hasWarnings(), false, stats.toString({ all: false, warnings: true }));
  } finally {
    await new Promise((resolve, reject) => {
      compiler.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function writeFixture(directory, extractCss) {
  // Apps import ordinary .scss files as modules; the styleguide scopes .module.*.
  const suffix = extractCss ? '.module' : '';
  const files = {
    ['primary' + suffix + '.scss']: [
      '$spacing: 13px;',
      '.panel { padding: $spacing; > .action { color: rgb(12, 34, 56); } }',
      '.icon-label { margin-left: 11px; }',
      ':global(.style-contract-global) { border-top: 3px solid rgb(65, 43, 21); }',
    ].join('\n'),
    ['secondary' + suffix + '.scss']: '.panel { padding: 29px; }',
    ['plain' + suffix + '.css']: '.plainCss { letter-spacing: 3px; }',
    'entry.js': [
      "import primary from './primary" + suffix + ".scss';",
      "import secondary from './secondary" + suffix + ".scss';",
      "import plain from './plain" + suffix + ".css';",
      "document.getElementById('primary').className = primary.panel;",
      "document.getElementById('action').className = primary.action;",
      "document.getElementById('label').className = primary.iconLabel;",
      "document.getElementById('secondary').className = secondary.panel;",
      "document.getElementById('plain').className = plain.plainCss;",
    ].join('\n'),
  };
  if (extractCss) {
    files['global.scss'] = '.style-contract-base { line-height: 23px; }';
    files['entry.js'] = "import './global.scss';\n" + files['entry.js'];
  }
  await Promise.all(Object.entries(files).map(([name, source]) => writeFile(path.join(directory, name), source)));
}

for (const owner of styleOwners) {
  test(owner.directory + ' preserves CSS/SCSS imports, scoping and rendered styles', { timeout: 30_000 }, async (t) => {
    const fixture = await mkdtemp(path.join(tmpdir(), 'sihsalus-style-contract-'));
    t.after(() => rm(fixture, { recursive: true, force: true }));
    const workspace = path.join(repositoryRoot, 'packages', owner.directory);
    const config = loadConfig(workspace, owner.configFile);
    const outputPath = path.join(fixture, 'dist');
    await writeFixture(fixture, owner.extractCss);

    // Exercise the actual loader rules and minimizers, with a small DOM fixture
    // instead of the app's entry points and Module Federation container.
    await compile({
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
    });

    const context = await browser.newContext({ offline: true });
    t.after(() => context.close());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setContent(
      '<section id="primary"><button id="action">Style fixture</button></section>' +
        '<span id="label">Label</span><section id="secondary">Second component</section>' +
        '<span id="plain">CSS fixture</span><div id="unscoped" class="panel">Unscoped</div>' +
        '<div id="global" class="style-contract-global">Global</div>' +
        '<div id="base" class="style-contract-base">Base styles</div>',
    );

    const cssAssets = (await readdir(outputPath)).filter((file) => file.endsWith('.css'));
    if (owner.extractCss) {
      assert.ok(cssAssets.length > 0, 'The styleguide must emit a CSS asset');
    }
    for (const asset of cssAssets) {
      await page.addStyleTag({ path: path.join(outputPath, asset) });
    }
    await page.addScriptTag({ path: path.join(outputPath, 'styles.js') });

    assert.deepEqual(errors, [], 'Compiled style imports must not throw in the browser');
    await expect(page.locator('#primary')).toHaveCSS('padding-top', '13px');
    await expect(page.locator('#secondary')).toHaveCSS('padding-top', '29px');
    await expect(page.locator('#action')).toHaveCSS('color', 'rgb(12, 34, 56)');
    await expect(page.locator('#label')).toHaveCSS('margin-left', '11px');
    await expect(page.locator('#plain')).toHaveCSS('letter-spacing', '3px');
    await expect(page.locator('#global')).toHaveCSS('border-top-width', '3px');
    await expect(page.locator('#global')).toHaveCSS('border-top-color', 'rgb(65, 43, 21)');
    await expect(page.locator('#unscoped')).toHaveCSS('padding-top', '0px');
    if (owner.extractCss) {
      await expect(page.locator('#base')).toHaveCSS('line-height', '23px');
    }
    assert.notEqual(
      await page.locator('#primary').getAttribute('class'),
      await page.locator('#secondary').getAttribute('class'),
      'Identically named classes in different components must remain isolated',
    );
  });
}
