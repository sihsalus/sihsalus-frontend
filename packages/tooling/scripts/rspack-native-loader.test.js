const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const Module = require('node:module');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { rspack } = require('@rspack/core');
const ts = require('typescript');

const root = path.resolve(__dirname, '../../..');

function applicationRule() {
  // Load the checked-in config, so this test does not depend on stale dist output.
  const filename = path.join(root, 'packages/tooling/rspack-config/src/index.ts');
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const configModule = new Module(filename, module);
  configModule.filename = filename;
  configModule.paths = Module._nodeModulePaths(path.dirname(filename));
  configModule._compile(compiled, filename);
  const previous = process.cwd();
  try {
    process.chdir(path.join(root, 'packages/apps/esm-home-app'));
    return configModule.exports.default({}, { mode: 'production' }).module.rules[0];
  } finally {
    process.chdir(previous);
  }
}

function compile(config) {
  return new Promise((resolve, reject) => {
    const compiler = rspack(config);
    compiler.run((error, stats) => {
      compiler.close((closeError) => {
        if (error || closeError) return reject(error || closeError);
        if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
        resolve();
      });
    });
  });
}

for (const [name, getRule] of [
  ['microfrontend', applicationRule],
  [
    'styleguide',
    () => require('../../libs/esm-styleguide/rspack.config.cjs')({}, { mode: 'production' }).module.rules[2],
  ],
]) {
  test(`${name} native loader compiles typed JSX with the automatic React runtime`, async () => {
    const rule = getRule();
    assert.equal(rule.loader, 'builtin:swc-loader');
    const directory = mkdtempSync(path.join(tmpdir(), 'sihsalus-swc-'));
    try {
      writeFileSync(
        path.join(directory, 'fixture.tsx'),
        'enum State { Ready = "ready" }; const text: string = State.Ready; export const element = <span>{text}</span>;',
      );
      await compile({
        mode: 'production',
        target: 'node',
        context: root,
        entry: path.join(directory, 'fixture.tsx'),
        output: { path: directory, filename: 'result.cjs', library: { type: 'commonjs2' } },
        resolve: { modules: [path.join(root, 'node_modules')] },
        module: { rules: [rule] },
      });
      const { element } = require(path.join(directory, 'result.cjs'));
      assert.equal(element.type, 'span');
      assert.equal(element.props.children, 'ready');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('production keeps the selected Carbon icon and removes unused icons from its bucket', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'sihsalus-carbon-icon-'));
  const rbacRequire = Module.createRequire(path.join(root, 'packages/libs/esm-rbac/package.json'));
  const iconRoot = path.dirname(rbacRequire.resolve('@carbon/icons-react/package.json'));
  try {
    writeFileSync(
      path.join(directory, 'fixture.tsx'),
      'import { Home } from "@carbon/icons-react"; export const element = <Home size={24} aria-label="Inicio" />;',
    );
    await compile({
      mode: 'production',
      target: 'node',
      context: root,
      entry: path.join(directory, 'fixture.tsx'),
      output: { path: directory, filename: 'result.cjs', library: { type: 'commonjs2' } },
      resolve: {
        modules: [path.join(root, 'node_modules')],
        alias: { '@carbon/icons-react$': iconRoot },
      },
      externals: {
        react: `commonjs ${require.resolve('react')}`,
        'react/jsx-runtime': `commonjs ${require.resolve('react/jsx-runtime')}`,
      },
      module: { rules: [applicationRule()] },
    });
    const { createElement } = require('react');
    const { renderToStaticMarkup } = require('react-dom/server');
    const { Home } = rbacRequire('@carbon/icons-react');
    const { element } = require(path.join(directory, 'result.cjs'));
    assert.equal(
      renderToStaticMarkup(element),
      renderToStaticMarkup(createElement(Home, { size: 24, 'aria-label': 'Inicio' })),
      'SVG geometry, size and accessible attributes must match the original icon',
    );
    // One icon plus its helpers fits comfortably here. The untransformed bucket
    // retains dozens of unrelated forwardRef calls and exceeds this budget.
    assert.ok(readFileSync(path.join(directory, 'result.cjs')).length < 16 * 1024, 'unused icon bucket retained');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
