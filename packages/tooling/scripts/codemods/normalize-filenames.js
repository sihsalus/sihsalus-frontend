#!/usr/bin/env node
/**
 * One-shot codemod: rename PascalCase / camelCase files and directories under
 * packages/apps to kebab-case, and rewrite every import that referred to them.
 *
 * Scope is deliberately packages/apps only. packages/libs/esm-react-utils and
 * esm-patient-common-lib are vendored from openmrs-esm-core and
 * openmrs-esm-patient-chart; renaming their files would make every future
 * upstream sync a conflict.
 *
 * Not wired into CI. Run once, verify with `yarn typecheck && yarn test`,
 * commit. New files are held to the convention by validate-package-shape.js.
 *
 * Usage:
 *   node packages/tooling/scripts/codemods/normalize-filenames.js [--dry-run]
 */

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../../..');
const renameRoot = 'packages/apps';

/** Files whose imports may need rewriting, anywhere in the repo. */
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/** Extensions a relative specifier may resolve to when written without one. */
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.scss', '.json'];

/**
 * Only source files get renamed. Assets and data files are referenced by string
 * paths this codemod does not parse (url() in SCSS, src= in JSX), and locale
 * files must keep their exact codes: pt_BR.json is not pt-br.json.
 */
const RENAMABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.scss']);

const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', '.turbo', 'coverage', '.git', 'translations']);

function kebabCase(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/** Split "use-foo.component.tsx" into ["use-foo", ".component.tsx"]. */
function splitName(fileName) {
  const dot = fileName.indexOf('.');
  return dot === -1 ? [fileName, ''] : [fileName.slice(0, dot), fileName.slice(dot)];
}

function walk(dir, out = { files: [], directories: [] }) {
  for (const entry of fs.readdirSync(path.join(repoRoot, dir), { withFileTypes: true })) {
    if (SKIP_DIRECTORIES.has(entry.name)) {
      continue;
    }
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.directories.push(relative);
      walk(relative, out);
    } else {
      out.files.push(relative);
    }
  }
  return out;
}

/**
 * Deepest paths first, so renaming a directory never invalidates a pending
 * rename of something inside it.
 */
function byDepthDescending(a, b) {
  return b.split('/').length - a.split('/').length;
}

function buildRenames() {
  const { files, directories } = walk(renameRoot);
  const renames = [];

  for (const directory of directories.sort(byDepthDescending)) {
    const name = path.posix.basename(directory);
    const kebab = kebabCase(name);
    if (kebab !== name) {
      renames.push({ from: directory, to: path.posix.join(path.posix.dirname(directory), kebab), isDirectory: true });
    }
  }

  for (const file of files) {
    if (!RENAMABLE_EXTENSIONS.has(path.extname(file))) {
      continue;
    }
    const name = path.posix.basename(file);
    const [stem, suffix] = splitName(name);
    const kebab = kebabCase(stem);
    if (kebab !== stem) {
      renames.push({ from: file, to: path.posix.join(path.posix.dirname(file), kebab + suffix), isDirectory: false });
    }
  }

  return renames;
}

/**
 * Apply every pending directory rename to a path, so a file's post-rename
 * location accounts for its ancestors moving too.
 */
function applyDirectoryRenames(filePath, directoryRenames) {
  let result = filePath;
  for (const { from, to } of directoryRenames) {
    if (result === from || result.startsWith(`${from}/`)) {
      result = to + result.slice(from.length);
    }
  }
  return result;
}

function detectCollisions(finalPaths) {
  const seen = new Map();
  const collisions = [];

  for (const [from, to] of finalPaths) {
    if (seen.has(to) && seen.get(to) !== from) {
      collisions.push({ to, sources: [seen.get(to), from] });
    }
    seen.set(to, from);
  }

  return collisions;
}

/**
 * Resolve a relative specifier against the pre-rename tree.
 * Returns the repo-relative path it points at, or null.
 */
function resolveSpecifier(fromFile, specifier, existingFiles) {
  if (!specifier.startsWith('.')) {
    return null;
  }

  const base = path.posix.join(path.posix.dirname(fromFile), specifier);

  if (existingFiles.has(base)) {
    return base;
  }
  for (const extension of RESOLVE_EXTENSIONS) {
    if (existingFiles.has(base + extension)) {
      return base + extension;
    }
  }
  for (const extension of RESOLVE_EXTENSIONS) {
    const indexPath = path.posix.join(base, `index${extension}`);
    if (existingFiles.has(indexPath)) {
      return indexPath;
    }
  }

  return null;
}

/** Every `from '...'`, `require('...')`, `import('...')` string in a source file. */
const SPECIFIER_PATTERN = /(\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|@use\s+|@forward\s+)(['"])([^'"]+)(\2)/g;

function rewriteImports(fileText, fromFile, renameMap, existingFiles) {
  return fileText.replace(SPECIFIER_PATTERN, (match, prefix, quote, specifier, closing) => {
    const resolved = resolveSpecifier(fromFile, specifier, existingFiles);
    if (!resolved || !renameMap.has(resolved)) {
      return match;
    }

    const target = renameMap.get(resolved);
    const hadExtension = path.posix.basename(specifier).includes('.');
    const specifierDir = path.posix.dirname(specifier);

    let newBase = path.posix.basename(target);
    if (!hadExtension) {
      // The specifier omitted the extension, so keep omitting it. If it pointed
      // at a directory index, the basename to swap is the directory's.
      newBase = path.posix.basename(target).includes('.')
        ? splitName(path.posix.basename(target))[0]
        : path.posix.basename(target);
      if (path.posix.basename(target).startsWith('index.')) {
        newBase = path.posix.basename(path.posix.dirname(target));
      }
    }

    const rebuilt = specifierDir === '.' ? `./${newBase}` : `${specifierDir}/${newBase}`;
    return `${prefix}${quote}${rebuilt}${closing}`;
  });
}

function gitMove(from, to, dryRun) {
  if (dryRun) {
    return;
  }

  const destination = path.join(repoRoot, to);
  fs.mkdirSync(path.dirname(destination), { recursive: true });

  // macOS is case-insensitive: a rename that only changes case has to go via a
  // temporary name or git loses the rename entirely.
  if (from.toLowerCase() === to.toLowerCase()) {
    const temporary = `${to}.__casefix__`;
    execFileSync('git', ['mv', from, temporary], { cwd: repoRoot });
    execFileSync('git', ['mv', temporary, to], { cwd: repoRoot });
    return;
  }

  execFileSync('git', ['mv', from, to], { cwd: repoRoot });
}

function main() {
  const dryRun = process.argv.includes('--dry-run');

  const renames = buildRenames();
  const directoryRenames = renames.filter((r) => r.isDirectory);

  // Map every renamed path to where it ends up once ancestors have moved too.
  const renameMap = new Map();
  for (const { from, to, isDirectory } of renames) {
    if (isDirectory) {
      continue;
    }
    renameMap.set(from, applyDirectoryRenames(to, directoryRenames));
  }
  // Files that only move because an ancestor directory was renamed still need
  // their importers updated.
  const { files: allAppFiles } = walk(renameRoot);
  for (const file of allAppFiles) {
    if (renameMap.has(file)) {
      continue;
    }
    const moved = applyDirectoryRenames(file, directoryRenames);
    if (moved !== file) {
      renameMap.set(file, moved);
    }
  }

  const collisions = detectCollisions([...renameMap.entries()]);
  if (collisions.length > 0) {
    console.error('Refusing to run: these renames would collide.\n');
    for (const { to, sources } of collisions) {
      console.error(`  ${to}\n    <- ${sources.join('\n    <- ')}`);
    }
    process.exit(1);
  }

  console.log(`${directoryRenames.length} directories, ${renames.length - directoryRenames.length} files to rename.`);
  console.log(`${renameMap.size} paths change in total (including files carried by a renamed directory).`);

  // Rewrite importers across the whole repo, against the pre-rename tree.
  const searchRoots = ['packages', 'e2e'];
  const existingFiles = new Set();
  for (const root of searchRoots) {
    for (const file of walk(root).files) {
      existingFiles.add(file);
    }
  }

  let rewritten = 0;
  for (const file of existingFiles) {
    const extension = path.extname(file);
    if (!SOURCE_EXTENSIONS.has(extension) && extension !== '.scss') {
      continue;
    }

    const absolute = path.join(repoRoot, file);
    const original = fs.readFileSync(absolute, 'utf8');
    const updated = rewriteImports(original, file, renameMap, existingFiles);

    if (updated !== original) {
      rewritten += 1;
      if (!dryRun) {
        fs.writeFileSync(absolute, updated);
      }
    }
  }

  console.log(`${rewritten} files had imports rewritten.`);

  if (dryRun) {
    console.log('\n[dry run] nothing moved.');
    return;
  }

  for (const { from, to, isDirectory } of renames) {
    const destination = isDirectory ? applyDirectoryRenames(to, directoryRenames.filter((d) => d.from !== from)) : to;
    gitMove(from, destination, dryRun);
  }

  console.log('Renames applied. Run `yarn typecheck && yarn test` before committing.');
}

main();
