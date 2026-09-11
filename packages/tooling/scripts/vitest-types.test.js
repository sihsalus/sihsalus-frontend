const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

test('Vitest globals and legacy mock aliases reject invalid mock types', () => {
  const packagesRoot = path.resolve(__dirname, '../..');
  const configPath = path.join(packagesRoot, 'tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);

  const parsed = ts.parseJsonConfigFileContent(
    {
      ...config.config,
      files: ['declarations.d.ts', 'types/vi-namespace/compatibility.typecheck.ts'],
      include: [],
      exclude: [],
    },
    ts.sys,
    packagesRoot,
    { strict: true, noEmit: true },
    configPath,
  );
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  const formatted = ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => packagesRoot,
    getNewLine: () => '\n',
  });
  assert.equal(diagnostics.length, 0, formatted);
});
