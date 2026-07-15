const assert = require('node:assert/strict');
const test = require('node:test');

const {
  hasPatchedAppShellSignature,
  hasUnpatchedAppShellSignature,
  patchedAppShellSignatures,
  unpatchedAppShellSignatures,
  userFacingErrorPatches,
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

test('moves every user-facing error patch from an unpatched to a patched signature', () => {
  for (const { search, replacement } of userFacingErrorPatches) {
    const source = `prefix${search}suffix`;
    const patchedSource = source.replaceAll(search, replacement);

    assert.equal(hasUnpatchedAppShellSignature(source), true);
    assert.equal(hasUnpatchedAppShellSignature(patchedSource), false);
    assert.equal(hasPatchedAppShellSignature(patchedSource), true);
  }
});
