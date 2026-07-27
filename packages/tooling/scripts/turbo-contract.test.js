const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const turboConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'turbo.json'), 'utf8'));
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

/**
 * Every workspace package.json reachable from the root `workspaces` globs.
 */
function readWorkspacePackages() {
  const packages = [];

  for (const pattern of rootPackageJson.workspaces ?? []) {
    if (!pattern.endsWith('/*')) {
      continue;
    }

    const parentDir = path.join(repoRoot, pattern.slice(0, -2));
    if (!fs.existsSync(parentDir)) {
      continue;
    }

    for (const entry of fs.readdirSync(parentDir)) {
      const manifestPath = path.join(parentDir, entry, 'package.json');
      if (fs.existsSync(manifestPath)) {
        packages.push(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
      }
    }
  }

  return packages;
}

const workspacePackages = readWorkspacePackages();

test('every turbo task is implemented by at least one workspace', () => {
  const orphans = Object.keys(turboConfig.tasks).filter(
    (task) => !workspacePackages.some((pkg) => pkg.scripts?.[task]),
  );

  assert.deepEqual(
    orphans,
    [],
    `turbo.json defines tasks no workspace implements: ${orphans.join(', ')}. ` +
      'Remove the task or add the script — an unimplemented task silently does nothing.',
  );
});

test('typecheck invalidates when any shared TypeScript base changes', () => {
  // Regression guard: these bases were missing from `inputs`, so editing the
  // strictness of the whole monorepo did not invalidate a single cached
  // typecheck. Every package would report a stale green.
  const required = [
    '$TURBO_ROOT$/tsconfig.base.json',
    '$TURBO_ROOT$/packages/tsconfig.json',
    '$TURBO_ROOT$/packages/tooling/tsconfig.app.json',
    '$TURBO_ROOT$/packages/declarations.d.ts',
  ];

  for (const input of required) {
    assert.ok(
      turboConfig.tasks.typescript.inputs.includes(input),
      `turbo.json tasks.typescript.inputs must include ${input}`,
    );
  }
});

test('tests invalidate when shared test fixtures change', () => {
  for (const task of ['test', 'coverage']) {
    assert.ok(
      turboConfig.tasks[task].inputs.includes('$TURBO_ROOT$/packages/test-utils/**'),
      `turbo.json tasks.${task}.inputs must include the shared test-utils directory`,
    );
    assert.ok(
      turboConfig.tasks[task].inputs.includes('$TURBO_ROOT$/packages/tooling/configs/**'),
      `turbo.json tasks.${task}.inputs must include the shared vitest configs`,
    );
  }
});

test('shared framework mocks are declared as test inputs', () => {
  // `mock.tsx` was missing while `mock.ts` was present, so edits to the
  // esm-framework / esm-styleguide / esm-react-utils mocks did not invalidate
  // the tests that consume them.
  for (const mock of ['mock.ts', 'mock.tsx', 'mock-vitest.ts', 'mock-vitest.tsx']) {
    assert.ok(turboConfig.tasks.test.inputs.includes(mock), `turbo.json tasks.test.inputs must include ${mock}`);
  }
});

test('no task declares an input file that exists nowhere in the repo', () => {
  const globChars = /[*?[\]{}]/;
  const dead = [];

  for (const [taskName, definition] of Object.entries(turboConfig.tasks)) {
    for (const rawInput of definition.inputs ?? []) {
      const input = rawInput.replace(/^!/, '');
      if (globChars.test(input)) {
        continue;
      }

      if (input.startsWith('$TURBO_ROOT$/')) {
        const absolute = path.join(repoRoot, input.slice('$TURBO_ROOT$/'.length));
        if (!fs.existsSync(absolute)) {
          dead.push(`${taskName}: ${rawInput}`);
        }
        continue;
      }

      // Package-relative input: it only has to exist in *some* workspace.
      if (!workspaceRelativeInputExists(input)) {
        dead.push(`${taskName}: ${rawInput}`);
      }
    }
  }

  assert.deepEqual(dead, [], `turbo.json declares inputs that match no file in the repo: ${dead.join(', ')}`);
});

/**
 * Package-relative inputs are legal as long as at least one workspace has the file.
 */
function workspaceRelativeInputExists(input) {
  for (const pattern of rootPackageJson.workspaces ?? []) {
    if (!pattern.endsWith('/*')) {
      continue;
    }

    const parentDir = path.join(repoRoot, pattern.slice(0, -2));
    if (!fs.existsSync(parentDir)) {
      continue;
    }

    for (const entry of fs.readdirSync(parentDir)) {
      if (fs.existsSync(path.join(parentDir, entry, input))) {
        return true;
      }
    }
  }

  return false;
}
