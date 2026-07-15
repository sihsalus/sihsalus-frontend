const assert = require('node:assert/strict');
const test = require('node:test');

const {
  appShellRuntimePatches,
  hasPatchedAppShellSignature,
  hasUnpatchedAppShellSignature,
  patchedAppShellSignatures,
  unpatchedAppShellSignatures,
  workspaceTranslationPatches,
} = require('./app-shell-runtime-patches');

test('does not classify translated application code as a patched app-shell bundle', () => {
  const patientVitalsTranslationChunk =
    'module.exports={unexpectedError:"Ocurrió un error inesperado. Por favor, inténtelo de nuevo."};';

  assert.equal(hasPatchedAppShellSignature(patientVitalsTranslationChunk), false);
  assert.equal(hasUnpatchedAppShellSignature('module.exports={error:"Oops! An unexpected error occurred."};'), false);
});

test('recognizes every generated app-shell runtime patch signature', () => {
  for (const signature of patchedAppShellSignatures) {
    assert.equal(hasPatchedAppShellSignature(`prefix${signature}suffix`), true);
  }
});

test('recognizes every unpatched app-shell runtime signature', () => {
  for (const signature of unpatchedAppShellSignatures) {
    assert.equal(hasUnpatchedAppShellSignature(`prefix${signature}suffix`), true);
  }
});

test('moves every app-shell patch from an unpatched to a patched signature', () => {
  for (const { search, replacement } of appShellRuntimePatches) {
    const source = `prefix${search}suffix`;
    const patchedSource = source.replaceAll(search, replacement);

    assert.equal(hasUnpatchedAppShellSignature(source), true);
    assert.equal(hasUnpatchedAppShellSignature(patchedSource), false);
    assert.equal(hasPatchedAppShellSignature(patchedSource), true);
  }
});

test('localizes the Spanish workspace close prompt embedded in the app shell', () => {
  const [{ search, replacement }] = workspaceTranslationPatches;

  assert.match(search, /"closeWorkspaces2PromptTitle":"Close workspace\(s\)"/);
  assert.match(replacement, /"closeWorkspaces2PromptTitle":"Cerrar espacios de trabajo"/);
  assert.match(replacement, /"closeWorkspaces2PromptBody":"Está a punto de cerrar los siguientes espacios/);
});
