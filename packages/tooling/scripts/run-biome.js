const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const biomeConfigPath = path.join(repoRoot, 'biome.json');
const biomeCliPath = require.resolve('@biomejs/biome/bin/biome');
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

const result = spawnSync(process.execPath, [biomeCliPath, command, '--config-path', biomeConfigPath, ...args], {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
