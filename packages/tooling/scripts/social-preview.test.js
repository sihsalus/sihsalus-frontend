const assert = require('node:assert/strict');
const test = require('node:test');

const {
  SOCIAL_PREVIEW_END,
  SOCIAL_PREVIEW_IMAGE_FILE,
  SOCIAL_PREVIEW_START,
  SOCIAL_PREVIEW_TITLE,
  applySocialPreview,
  buildSocialPreviewTags,
  escapeHtmlAttribute,
  isAbsoluteHttpUrl,
  joinUrl,
  resolveSocialPreviewBaseUrl,
  toOpenGraphLocale,
} = require('./social-preview');

test('prefers the explicit public SPA URL over the backend origin', () => {
  const resolved = resolveSocialPreviewBaseUrl({
    spaPath: '/openmrs/spa',
    publicSpaUrl: 'https://salud.example.test/openmrs/spa/',
    backendUrl: 'https://backend.example.test/openmrs',
  });

  assert.deepEqual(resolved, { baseUrl: 'https://salud.example.test/openmrs/spa', source: 'public-url' });
});

test('derives the public URL from the backend origin when no public URL is set', () => {
  const resolved = resolveSocialPreviewBaseUrl({
    spaPath: '/openmrs/spa',
    publicSpaUrl: '',
    backendUrl: 'https://backend.example.test:8443/openmrs',
  });

  assert.deepEqual(resolved, { baseUrl: 'https://backend.example.test:8443/openmrs/spa', source: 'backend-origin' });
});

test('uses only the backend origin, not its path, for the derived public URL', () => {
  const resolved = resolveSocialPreviewBaseUrl({
    spaPath: '/openmrs/spa',
    publicSpaUrl: '',
    backendUrl: 'https://backend.example.test/openmrs/extra/path',
  });

  assert.equal(resolved.baseUrl, 'https://backend.example.test/openmrs/spa');
});

test('falls back to the relative SPA path when the backend URL is malformed', () => {
  const resolved = resolveSocialPreviewBaseUrl({
    spaPath: 'openmrs/spa/',
    publicSpaUrl: '   ',
    backendUrl: 'backend.example.test/openmrs',
  });

  assert.deepEqual(resolved, { baseUrl: '/openmrs/spa', source: 'invalid-backend-url' });
});

test('falls back to the relative SPA path when nothing is configured', () => {
  const resolved = resolveSocialPreviewBaseUrl({ spaPath: '/openmrs/spa', publicSpaUrl: '', backendUrl: '' });

  assert.deepEqual(resolved, { baseUrl: '/openmrs/spa', source: 'spa-path' });
});

test('social preview tags describe the SPA with Open Graph and Twitter metadata', () => {
  const tags = buildSocialPreviewTags({ baseUrl: 'https://salud.example.test/openmrs/spa', locale: 'es' });

  assert.ok(tags.startsWith(SOCIAL_PREVIEW_START));
  assert.ok(tags.endsWith(SOCIAL_PREVIEW_END));

  const requiredTags = [
    `<meta property="og:site_name" content="${SOCIAL_PREVIEW_TITLE}">`,
    `<meta property="og:title" content="${SOCIAL_PREVIEW_TITLE}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="es_PE">',
    '<meta property="og:url" content="https://salud.example.test/openmrs/spa">',
    `<meta property="og:image" content="https://salud.example.test/openmrs/spa/${SOCIAL_PREVIEW_IMAGE_FILE}">`,
    '<meta property="og:image:type" content="image/png">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:image" content="https://salud.example.test/openmrs/spa/${SOCIAL_PREVIEW_IMAGE_FILE}">`,
    `<meta name="twitter:image:alt" content="${SOCIAL_PREVIEW_TITLE}">`,
  ];
  for (const requiredTag of requiredTags) {
    assert.ok(tags.includes(requiredTag), `Missing tag: ${requiredTag}`);
  }
});

test('maps bare language codes to Open Graph locales', () => {
  assert.equal(toOpenGraphLocale('es'), 'es_PE');
  assert.equal(toOpenGraphLocale('es-PE'), 'es_PE');
  assert.equal(toOpenGraphLocale('en'), 'en_US');
  assert.equal(toOpenGraphLocale('qu-PE'), 'qu_PE');
  assert.equal(toOpenGraphLocale(''), 'es_PE');
});

test('escapes attribute values embedded in the preview tags', () => {
  assert.equal(escapeHtmlAttribute('a&b"<c>'), 'a&amp;b&quot;&lt;c&gt;');
});

test('joins URLs without duplicating slashes', () => {
  assert.equal(joinUrl('https://a.test/spa/', '/img.png'), 'https://a.test/spa/img.png');
  assert.equal(joinUrl('https://a.test/spa', 'img.png'), 'https://a.test/spa/img.png');
});

test('recognizes absolute http(s) URLs', () => {
  assert.ok(isAbsoluteHttpUrl('https://a.test/spa'));
  assert.ok(isAbsoluteHttpUrl('HTTP://a.test'));
  assert.ok(!isAbsoluteHttpUrl('/openmrs/spa'));
  assert.ok(!isAbsoluteHttpUrl(''));
});

test('patches the title and injects exactly one social preview block', () => {
  const html =
    '<!doctype html><html lang="en"><head><title>OpenMRS</title><meta charset="utf-8"></head><body></body></html>';

  const once = applySocialPreview(html, { baseUrl: 'https://a.test/openmrs/spa', locale: 'es' });
  assert.ok(once.includes(`<title>${SOCIAL_PREVIEW_TITLE}</title>`));
  assert.equal(once.split(SOCIAL_PREVIEW_START).length, 2);
  assert.equal(once.split(SOCIAL_PREVIEW_END).length, 2);
  assert.ok(once.includes(`${SOCIAL_PREVIEW_END}</head>`));

  const twice = applySocialPreview(once, { baseUrl: 'https://b.test/openmrs/spa', locale: 'es' });
  assert.equal(twice.split(SOCIAL_PREVIEW_START).length, 2);
  assert.equal(twice.split(SOCIAL_PREVIEW_END).length, 2);
  assert.ok(twice.includes('https://b.test/openmrs/spa'));
  assert.ok(!twice.includes('https://a.test/openmrs/spa'));
});
