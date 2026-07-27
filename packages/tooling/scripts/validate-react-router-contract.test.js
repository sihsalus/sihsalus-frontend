const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { peerRange, targetVersion, validateReactRouterContract } = require('./validate-react-router-contract');

function createFixture({ rootVersion = targetVersion, peerVersion = peerRange, rootRscDependency, source = '' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'react-router-contract-'));
  const appDirectory = path.join(root, 'packages/apps/clinical-app/src');
  fs.mkdirSync(appDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      resolutions: {
        'react-router': rootVersion,
        'react-router-dom': rootVersion,
      },
      dependencies: rootRscDependency ? { 'react-server-dom-webpack': rootRscDependency } : undefined,
    }),
  );
  fs.writeFileSync(
    path.join(root, 'packages/apps/clinical-app/package.json'),
    JSON.stringify({
      name: 'clinical-app',
      peerDependencies: { 'react-router-dom': peerVersion },
      devDependencies: { 'react-router-dom': rootVersion },
    }),
  );
  fs.writeFileSync(path.join(appDirectory, 'root.tsx'), source);
  fs.writeFileSync(
    path.join(root, 'yarn.lock'),
    `"react-router-dom@npm:${rootVersion}":\n  resolution: "react-router-dom@npm:${rootVersion}"\n\n"react-router@npm:${rootVersion}":\n  resolution: "react-router@npm:${rootVersion}"\n`,
  );
  return root;
}

test('accepts the production React Router version and shared peer contract', () => {
  const root = createFixture({ source: "import { BrowserRouter } from 'react-router-dom';" });
  assert.deepEqual(validateReactRouterContract(root), []);
});

test('rejects vulnerable resolutions, missing sharing declarations, and removed v6 flags', () => {
  const root = createFixture({
    rootVersion: '6.30.4',
    peerVersion: '6.x',
    rootRscDependency: '19.2.0',
    source:
      "import { BrowserRouter } from 'react-router-dom';\nimport { unstable_matchRSCServerRequest } from 'react-router';\n<BrowserRouter future={{ v7_startTransition: true }} />;",
  });
  const failures = validateReactRouterContract(root);

  assert.ok(failures.some((failure) => failure.includes('resolutions.react-router must be "7.18.1"')));
  assert.ok(failures.some((failure) => failure.includes('peer react-router-dom must be ">=6.30.4 <8"')));
  assert.ok(failures.some((failure) => failure.includes('contains a removed React Router v6 future flag')));
  assert.ok(failures.some((failure) => failure.includes('uses an unstable React Router RSC API')));
  assert.ok(failures.some((failure) => failure.includes('dependencies.react-server-dom-webpack')));
  assert.ok(failures.some((failure) => failure.includes('react-router-dom resolves to 6.30.4')));
});

test('keeps the repository contract valid', () => {
  assert.deepEqual(validateReactRouterContract(), []);
});
