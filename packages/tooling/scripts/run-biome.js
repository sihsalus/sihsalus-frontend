const { existsSync, readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const biomeConfigPath = path.join(repoRoot, 'biome.json');
const yarnRcPath = path.join(repoRoot, '.yarnrc.yml');
const [command = 'lint', ...rawArgs] = process.argv.slice(2);
const workspacePath = path.relative(repoRoot, process.cwd());

function toRepoRelative(filePath) {
  const relativePath = path.relative(repoRoot, filePath);
  return relativePath || '.';
}

function normalizePathArg(arg) {
  if (arg === '.') {
    return workspacePath || '.';
  }

  const candidates = path.isAbsolute(arg)
    ? [arg]
    : [
        path.resolve(process.cwd(), arg),
        path.resolve(repoRoot, arg),
        path.resolve(path.sep, arg),
        ...(workspacePath ? [path.resolve(repoRoot, workspacePath, arg)] : []),
      ];

  const existingPath = candidates.find((candidate) => existsSync(candidate));
  if (existingPath) {
    return toRepoRelative(existingPath);
  }

  return workspacePath ? path.join(workspacePath, arg) : arg;
}

const args = (rawArgs.length > 0 ? rawArgs : ['.']).map((arg) => {
  if (arg.startsWith('-')) {
    return arg;
  }

  return normalizePathArg(arg);
});

const biomeArgs = ['exec', 'biome', command, '--config-path', biomeConfigPath, ...args];
const { command: spawnCommand, args: spawnPrefixArgs } = resolveYarnCommand();
const spawnArgs = [...spawnPrefixArgs, ...biomeArgs];

const result = spawnSync(spawnCommand, spawnArgs, {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);

function resolveYarnCommand() {
  if (existsSync(yarnRcPath)) {
    const yarnRc = readFileSync(yarnRcPath, 'utf8');
    const yarnPathMatch = yarnRc.match(/^\s*yarnPath:\s+(.+)$/m);
    if (yarnPathMatch) {
      const configuredPath = yarnPathMatch[1].trim().replace(/^['"]|['"]$/g, '');
      const absoluteYarnPath = path.resolve(repoRoot, configuredPath);
      if (existsSync(absoluteYarnPath)) {
        return {
          command: process.execPath,
          args: [absoluteYarnPath],
        };
      }
    }
  }

  if (process.platform === 'win32') {
    return {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'yarn'],
    };
  }

  return {
    command: 'yarn',
    args: [],
  };
}
