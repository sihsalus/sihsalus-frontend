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
