#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const emptyTreeHash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

function parseArgs(argv) {
  const args = {
    base: 'HEAD',
    head: '',
    staged: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base') {
      args.base = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === '--head') {
      args.head = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === '--staged') {
      args.staged = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.staged && (args.base !== 'HEAD' || args.head)) {
    throw new Error('`--staged` cannot be combined with `--base` or `--head`.');
  }

  return args;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function getChangedFiles(args, spawn = spawnSync) {
  const diffArgs = ['diff', '--name-only', '--diff-filter=ACMR', '-z'];

  if (args.staged) {
    diffArgs.push('--cached');
  } else if (args.head) {
    if (/^0+$/.test(args.base)) {
      diffArgs.push(emptyTreeHash, args.head);
    } else {
      diffArgs.push(`${args.base}...${args.head}`);
    }
  } else {
    diffArgs.push(args.base);
  }

  const result = spawn('git', diffArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'Unable to read changed files from git.');
  }

  return result.stdout.split('\0').filter(Boolean);
}

function selectScssFiles(changedFiles, fileExists = fs.existsSync) {
  return changedFiles
    .filter((file) => file.toLowerCase().endsWith('.scss'))
    .filter((file) => fileExists(path.join(repoRoot, file)))
    .sort();
}

function checkFormatting(files, spawn = spawnSync) {
  const yarnCommand = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  const result = spawn(yarnCommand, ['exec', 'prettier', '--check', '--', ...files], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

function printHelp() {
  console.log(`Usage: yarn validate:scss-format [--base <git-ref>] [--head <git-ref>] [--staged]

Checks only added, copied, modified, or renamed SCSS files with the same
Prettier configuration used by lint-staged.

Examples:
- yarn validate:scss-format --base origin/main --head HEAD
- yarn validate:scss-format --staged`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const files = selectScssFiles(getChangedFiles(args));
  if (files.length === 0) {
    console.log('[scss-format] No changed SCSS files to check.');
    return;
  }

  console.log(`[scss-format] Checking ${files.length} changed SCSS file(s).`);
  process.exitCode = checkFormatting(files);
}

if (require.main === module) {
  main();
}

module.exports = {
  checkFormatting,
  getChangedFiles,
  parseArgs,
  selectScssFiles,
};
