import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const cliPath = fileURLToPath(new URL('./cli.ts', import.meta.url));
const configPath = fileURLToPath(new URL('../tsconfig.json', import.meta.url));
const config = ts.readConfigFile(configPath, ts.sys.readFile).config;
const { options } = ts.convertCompilerOptionsFromJson(config.compilerOptions, configPath);
const compiledCli = ts.transpileModule(readFileSync(cliPath, 'utf8'), { compilerOptions: options }).outputText;

// Run the emitted CommonJS against the installed yargs in a fresh Node process.
// Only command side effects are replaced: no server, browser or backend starts.
const bootstrap = String.raw`
  const { readFileSync } = require('node:fs');
  const { createRequire } = require('node:module');
  const { dirname } = require('node:path');
  const { runInNewContext } = require('node:vm');
  const { source, filename } = JSON.parse(readFileSync(0, 'utf8'));
  const nodeRequire = createRequire(filename);
  process.argv = [process.execPath, filename, ...process.argv.slice(1)];
  const requireModule = (id) => {
    if (id === 'node:child_process') {
      return { fork: () => ({
        send: (message) => console.log('CLI_DISPATCH:' + JSON.stringify(message)),
        on: () => {},
      }) };
    }
    if (id === './utils') {
      return new Proxy({}, { get: () => () => { throw new Error('Unexpected command side effect'); } });
    }
    return nodeRequire(id);
  };
  runInNewContext(source, { require: requireModule, exports: {}, __dirname: dirname(filename), process });
`;

function runCli(args: string[]) {
  return spawnSync(process.execPath, ['--input-type=commonjs', '-e', bootstrap, '--', ...args], {
    input: JSON.stringify({ source: compiledCli, filename: cliPath }),
    encoding: 'utf8',
    timeout: 10_000,
  });
}

describe('CommonJS CLI argument parsing', () => {
  it.each(
    [[], ['debug'], ['develop'], ['build'], ['assemble'], ['start']].map((command) => ({ command })),
  )('prints help without starting a command ($command)', ({ command }) => {
    const result = runCli([...command, '--help']);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('--help');
    expect(result.stdout).not.toContain('CLI_DISPATCH:');
  });

  it('rejects an unknown option before starting a command', () => {
    const result = runCli(['start', '--synthetic-unknown-option']);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Unknown arguments?: synthetic-unknown-option/);
    expect(result.stdout).not.toContain('CLI_DISPATCH:');
  });

  it.each([['start'], []].map((command) => ({ command })))('parses explicit and default start arguments ($command)', ({
    command,
  }) => {
    const result = runCli([...command, '--port', '8123', '--backend', 'https://synthetic.invalid', '--open']);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const line = result.stdout.split('\n').find((value) => value.startsWith('CLI_DISPATCH:'));
    expect(line).toBeDefined();
    expect(JSON.parse(line.slice('CLI_DISPATCH:'.length))).toMatchObject({
      type: 'runStart',
      args: { port: 8123, backend: 'https://synthetic.invalid', open: true },
    });
  });
});
