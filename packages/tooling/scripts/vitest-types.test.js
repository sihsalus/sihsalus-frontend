const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

test('Vitest globals and imported mock types reject invalid mock types', () => {
  const packagesRoot = path.resolve(__dirname, '../..');
  const configPath = path.join(packagesRoot, 'tsconfig.json');
  const fixturePath = path.join(packagesRoot, 'vitest-types.typecheck.ts');
  // Compile this virtual fixture without adding generated files to the worktree.
  const fixtureSource = `
import type { Mock, MockInstance, MockedFunction, MockedObject } from 'vitest';

const load = vi.fn<(id: string) => Promise<number>>();
const typedLoad: MockedFunction<(id: string) => Promise<number>> = load;
typedLoad('synthetic-id');
typedLoad.mockResolvedValue(42);
typedLoad.mockImplementation(async (id) => id.length);
// @ts-expect-error MockedFunction preserves the function's argument type.
typedLoad(42);
// @ts-expect-error MockedFunction preserves the resolved result type.
typedLoad.mockResolvedValue('invalid');
// @ts-expect-error An asynchronous function needs an asynchronous implementation.
typedLoad.mockImplementation((id) => id.length);

const typedMock: Mock = vi.fn();
typedMock.mockClear();
// @ts-expect-error Mock exposes the real mock API, not any.
typedMock.missingMockMethod();

const typedSpy: MockInstance = vi.spyOn({ load }, 'load');
typedSpy.mockRestore();
// @ts-expect-error MockInstance preserves the official instance API.
typedSpy.missingSpyMethod();

const typedObject: MockedObject<{ load: () => Promise<number>; label: string }> = {
  load: vi.fn<() => Promise<number>>(),
  label: 'synthetic',
};
typedObject.load.mockResolvedValue(42);
// @ts-expect-error MockedObject preserves ordinary property types.
typedObject.label = 42;
// @ts-expect-error MockedObject preserves mocked method result types.
typedObject.load.mockResolvedValue('invalid');

const inferredMock = vi.mocked(load);
inferredMock.mockResolvedValue(42);
// @ts-expect-error The global vi.mocked helper must preserve function types.
inferredMock.mockResolvedValue('invalid');
// @ts-expect-error Mock is a type-only import, not a runtime value.
Mock;
`;
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);

  const parsed = ts.parseJsonConfigFileContent(
    {
      ...config.config,
      files: ['declarations.d.ts', fixturePath],
      include: [],
      exclude: [],
    },
    ts.sys,
    packagesRoot,
    { strict: true, noImplicitAny: true, strictNullChecks: true, noEmit: true },
    configPath,
  );
  const host = ts.createCompilerHost(parsed.options);
  const readSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
    path.resolve(fileName) === fixturePath
      ? ts.createSourceFile(fileName, fixtureSource, languageVersion)
      : readSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  const formatted = ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => packagesRoot,
    getNewLine: () => '\n',
  });
  assert.equal(diagnostics.length, 0, formatted);
});
