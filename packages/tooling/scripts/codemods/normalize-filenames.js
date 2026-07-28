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

/** Roots searched for importers that may need rewriting. */
const IMPORTER_ROOTS = ['packages', 'e2e'];

/** File types whose import specifiers this codemod understands. */
const IMPORTER_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.scss']);

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

/** Deepest paths first. */
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
    const [stem, suffix] = splitName(path.posix.basename(file));
    const kebab = kebabCase(stem);
    if (kebab !== stem) {
      renames.push({ from: file, to: path.posix.join(path.posix.dirname(file), kebab + suffix), isDirectory: false });
    }
  }

  return renames;
}

/** Apply every directory rename to a path, so ancestors moving is accounted for. */
function applyDirectoryRenames(filePath, directoryRenames) {
  let result = filePath;
  for (const { from, to } of directoryRenames) {
    if (result === from || result.startsWith(`${from}/`)) {
      result = to + result.slice(from.length);
    }
  }
  return result;
}

function detectCollisions(entries) {
  const seen = new Map();
  const collisions = [];

  for (const [from, to] of entries) {
    if (seen.has(to) && seen.get(to) !== from) {
      collisions.push({ to, sources: [seen.get(to), from] });
    }
    seen.set(to, from);
  }

  return collisions;
}

/**
 * Alias maps declared per app in rspack.config.js, e.g. '@hooks' -> src/hooks.
 * Their specifiers never start with '.', so relative resolution cannot see them.
 */
const aliasCache = new Map();

function aliasesFor(appDir) {
  if (aliasCache.has(appDir)) {
    return aliasCache.get(appDir);
  }

  const aliases = [];
  const configPath = path.join(repoRoot, appDir, 'rspack.config.js');

  if (fs.existsSync(configPath)) {
    try {
      delete require.cache[require.resolve(configPath)];
      const alias = require(configPath)?.additionalConfig?.resolve?.alias ?? {};
      for (const [key, absoluteTarget] of Object.entries(alias)) {
        if (typeof absoluteTarget !== 'string') {
          continue;
        }
        const relativeTarget = path.relative(repoRoot, absoluteTarget).split(path.sep).join('/');
        if (relativeTarget.startsWith(appDir)) {
          aliases.push({ key, target: relativeTarget });
        }
      }
    } catch {
      // A config we cannot evaluate simply contributes no aliases.
    }
  }

  aliases.sort((a, b) => b.key.length - a.key.length);
  aliasCache.set(appDir, aliases);
  return aliases;
}

/** The `packages/apps/<name>` prefix of a path, or null. */
function appDirOf(filePath) {
  const segments = filePath.split('/');
  return segments[0] === 'packages' && segments[1] === 'apps' ? `packages/apps/${segments[2]}` : null;
}

function resolveFileCandidate(base, existingFiles) {
  if (existingFiles.has(base)) {
    return base;
  }
  for (const extension of RESOLVE_EXTENSIONS) {
    if (existingFiles.has(base + extension)) {
      return base + extension;
    }
  }
  // SCSS partials: './vars' lives on disk as '_vars.scss'.
  const partial = path.posix.join(path.posix.dirname(base), `_${path.posix.basename(base)}.scss`);
  if (existingFiles.has(partial)) {
    return partial;
  }
  for (const extension of RESOLVE_EXTENSIONS) {
    const indexPath = path.posix.join(base, `index${extension}`);
    if (existingFiles.has(indexPath)) {
      return indexPath;
    }
  }
  return null;
}

/**
 * Resolve a specifier against the pre-rename tree, relative or aliased.
 * Returns { file, alias } where alias is set when it resolved through one.
 */
function resolveSpecifier(fromFile, specifier, existingFiles) {
  if (!specifier.startsWith('.')) {
    const appDir = appDirOf(fromFile);
    if (!appDir) {
      return null;
    }
    for (const alias of aliasesFor(appDir)) {
      if (specifier !== alias.key && !specifier.startsWith(`${alias.key}/`)) {
        continue;
      }
      const tail = specifier.slice(alias.key.length).replace(/^\//, '');
      const file = resolveFileCandidate(tail ? path.posix.join(alias.target, tail) : alias.target, existingFiles);
      if (file) {
        return { file, alias };
      }
    }
    return null;
  }

  const file = resolveFileCandidate(path.posix.join(path.posix.dirname(fromFile), specifier), existingFiles);
  return file ? { file, alias: null } : null;
}

/**
 * Rebuild a specifier from where the importer and its target both end up.
 * Deriving it from the final positions is what makes a renamed *directory* in
 * the middle of the path get rewritten too, not just the name at the end.
 */
function rebuildSpecifier(fromFile, specifier, resolved, alias, renameMap) {
  const newImporter = renameMap.get(fromFile) ?? fromFile;
  const newTarget = renameMap.get(resolved) ?? resolved;

  // An aliased specifier keeps its prefix; only the tail under the alias target
  // moves. The alias target itself is a directory this codemod does not rename.
  if (alias) {
    // Some aliases point at a single file rather than a directory (@types ->
    // src/types.ts). There is no tail to recompute, and treating the file as a
    // directory would yield '@types/../types'.
    if (alias.target === resolved) {
      return alias.key;
    }
    const [stem] = splitName(path.posix.basename(newTarget));
    const tail = path.posix.relative(alias.target, path.posix.join(path.posix.dirname(newTarget), stem));
    return tail ? `${alias.key}/${tail}` : alias.key;
  }

  const specifierBase = path.posix.basename(specifier);
  const resolvedBase = path.posix.basename(resolved);

  let targetPath;
  if (resolvedBase === `_${specifierBase}.scss`) {
    // SCSS partial: the specifier carries neither the underscore nor the suffix.
    const [newStem] = splitName(path.posix.basename(newTarget).replace(/^_/, ''));
    targetPath = path.posix.join(path.posix.dirname(newTarget), newStem);
  } else if (resolvedBase.startsWith(specifierBase)) {
    // The specifier named the file; whatever it left off (".tsx", "") is the
    // same suffix to leave off the new name.
    const omitted = resolvedBase.slice(specifierBase.length);
    const newBase = path.posix.basename(newTarget);
    targetPath = path.posix.join(
      path.posix.dirname(newTarget),
      omitted ? newBase.slice(0, newBase.length - omitted.length) : newBase,
    );
  } else {
    // The specifier named a directory and resolution found its index file.
    targetPath = path.posix.dirname(newTarget);
  }

  const rebuilt = path.posix.relative(path.posix.dirname(newImporter), targetPath);
  return rebuilt.startsWith('.') ? rebuilt : `./${rebuilt}`;
}

/**
 * `from '...'`, `require('...')`, `import('...')`, `@use`, `@forward`, and the
 * test doubles. vi.mock() matters as much as the import: a mock whose path no
 * longer resolves does not fail, it silently stops mocking, and the test then
 * exercises the real implementation while still passing.
 */
const SPECIFIER_PATTERN =
  /(\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|\b(?:vi|jest)\.(?:mock|doMock|unmock)\s*\(\s*|\bvi\.(?:importActual|importMock)\s*(?:<[^>]*>)?\s*\(\s*|@use\s+|@forward\s+)(['"])([^'"]+)(\2)/g;

function rewriteImports(fileText, fromFile, renameMap, existingFiles) {
  return fileText.replace(SPECIFIER_PATTERN, (match, prefix, quote, specifier, closing) => {
    const resolution = resolveSpecifier(fromFile, specifier, existingFiles);
    if (!resolution) {
      return match;
    }

    // A specifier only needs rewriting if one of its two endpoints moved.
    // Without this guard the path is recomputed for untouched packages too, and
    // any imperfection in the reconstruction corrupts them.
    if (!renameMap.has(resolution.file) && !renameMap.has(fromFile)) {
      return match;
    }

    const rebuilt = rebuildSpecifier(fromFile, specifier, resolution.file, resolution.alias, renameMap);
    return rebuilt === specifier ? match : `${prefix}${quote}${rebuilt}${closing}`;
  });
}

function gitMove(from, to) {
  const run = (...args) => {
    try {
      execFileSync('git', args, { cwd: repoRoot, stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (error) {
      const detail = error.stderr ? error.stderr.toString().trim() : error.message;
      throw new Error(`git ${args.join(' ')}\n  ${detail}`);
    }
  };

  fs.mkdirSync(path.dirname(path.join(repoRoot, to)), { recursive: true });

  // macOS is case-insensitive: a rename that only changes case has to go via a
  // temporary name or git loses the rename entirely.
  if (from.toLowerCase() === to.toLowerCase()) {
    const temporary = `${to}.__casefix__`;
    run('mv', from, temporary);
    run('mv', temporary, to);
    return;
  }

  run('mv', from, to);
}

function main() {
  const dryRun = process.argv.includes('--dry-run');

  const renames = buildRenames();
  const directoryRenames = renames.filter((rename) => rename.isDirectory);

  const existingFiles = new Set();
  for (const root of IMPORTER_ROOTS) {
    for (const file of walk(root).files) {
      existingFiles.add(file);
    }
  }

  // Where every app file ends up, whether renamed itself or carried by an
  // ancestor directory that was.
  const renameMap = new Map();
  for (const { from, to, isDirectory } of renames) {
    if (!isDirectory) {
      renameMap.set(from, applyDirectoryRenames(to, directoryRenames));
    }
  }
  for (const file of walk(renameRoot).files) {
    if (!renameMap.has(file)) {
      const moved = applyDirectoryRenames(file, directoryRenames);
      if (moved !== file) {
        renameMap.set(file, moved);
      }
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
  console.log(`${renameMap.size} paths change in total.`);

  let rewritten = 0;
  for (const file of existingFiles) {
    if (!IMPORTER_EXTENSIONS.has(path.extname(file))) {
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

  // Files first, while every directory still has its original name, so each
  // recorded `from` path is still valid. Directories afterwards, already sorted
  // deepest-first, so renaming an inner directory never invalidates the outer.
  for (const { from, to, isDirectory } of renames) {
    if (!isDirectory) {
      gitMove(from, to);
    }
  }
  for (const { from, to, isDirectory } of renames) {
    if (isDirectory) {
      gitMove(from, to);
    }
  }

  console.log('Renames applied. Run `yarn typecheck && yarn test` before committing.');
}

main();
