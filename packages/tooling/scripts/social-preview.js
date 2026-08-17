const SOCIAL_PREVIEW_START = '<!-- SIHSALUS social preview -->';
const SOCIAL_PREVIEW_END = '<!-- /SIHSALUS social preview -->';
const SOCIAL_PREVIEW_TITLE = 'SIH.SALUS';
const SOCIAL_PREVIEW_DESCRIPTION = 'Sistema de información en salud';
const SOCIAL_PREVIEW_IMAGE_FILE = 'sihsalus-share.png';

function escapeHtmlAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function joinUrl(baseUrl, pathSegment) {
  return `${baseUrl.replace(/\/+$/, '')}/${pathSegment.replace(/^\/+/, '')}`;
}

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

// Open Graph locales are language_TERRITORY; bare language codes come from
// SPA_DEFAULT_LOCALE and default to the deployment's territory.
function toOpenGraphLocale(locale) {
  const normalized = String(locale || '')
    .trim()
    .replace(/-/g, '_');
  if (!normalized || /^es$/i.test(normalized)) {
    return 'es_PE';
  }
  if (/^en$/i.test(normalized)) {
    return 'en_US';
  }
  return normalized;
}

function normalizeSpaPath(spaPath) {
  const withLeadingSlash = String(spaPath || '/').startsWith('/') ? String(spaPath || '/') : `/${spaPath}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
}

/**
 * Resolves the absolute base URL used for og:/twitter: links. Precedence:
 * explicit public URL, then the backend origin joined with the SPA path,
 * then the relative SPA path (source tells the caller which one applied:
 * 'public-url' | 'backend-origin' | 'invalid-backend-url' | 'spa-path').
 */
function resolveSocialPreviewBaseUrl({ spaPath, publicSpaUrl, backendUrl }) {
  const normalizedSpaPath = normalizeSpaPath(spaPath);
  const explicitUrl = String(publicSpaUrl || '')
    .trim()
    .replace(/\/+$/, '');

  if (explicitUrl) {
    return { baseUrl: explicitUrl, source: 'public-url' };
  }

  const trimmedBackendUrl = String(backendUrl || '').trim();
  if (trimmedBackendUrl) {
    try {
      const backend = new URL(trimmedBackendUrl);
      return { baseUrl: joinUrl(backend.origin, normalizedSpaPath), source: 'backend-origin' };
    } catch {
      return { baseUrl: normalizedSpaPath, source: 'invalid-backend-url' };
    }
  }

  return { baseUrl: normalizedSpaPath, source: 'spa-path' };
}

function buildSocialPreviewTags({ baseUrl, locale }) {
  const imageUrl = joinUrl(baseUrl, SOCIAL_PREVIEW_IMAGE_FILE);
  const ogLocale = toOpenGraphLocale(locale);
  return `${SOCIAL_PREVIEW_START}
<meta name="description" content="${escapeHtmlAttribute(SOCIAL_PREVIEW_DESCRIPTION)}">
<meta property="og:site_name" content="${escapeHtmlAttribute(SOCIAL_PREVIEW_TITLE)}">
<meta property="og:title" content="${escapeHtmlAttribute(SOCIAL_PREVIEW_TITLE)}">
<meta property="og:description" content="${escapeHtmlAttribute(SOCIAL_PREVIEW_DESCRIPTION)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="${escapeHtmlAttribute(ogLocale)}">
<meta property="og:url" content="${escapeHtmlAttribute(baseUrl)}">
<meta property="og:image" content="${escapeHtmlAttribute(imageUrl)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escapeHtmlAttribute(SOCIAL_PREVIEW_TITLE)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtmlAttribute(SOCIAL_PREVIEW_TITLE)}">
<meta name="twitter:description" content="${escapeHtmlAttribute(SOCIAL_PREVIEW_DESCRIPTION)}">
<meta name="twitter:image" content="${escapeHtmlAttribute(imageUrl)}">
<meta name="twitter:image:alt" content="${escapeHtmlAttribute(SOCIAL_PREVIEW_TITLE)}">
${SOCIAL_PREVIEW_END}`;
}

/**
 * Patches the document title and injects exactly one social preview block
 * before </head>. Safe to run over an already-patched index.html.
 */
function applySocialPreview(html, { baseUrl, locale }) {
  const tags = buildSocialPreviewTags({ baseUrl, locale });
  let result = String(html);
  result = result.replace(/<title>[\s\S]*?<\/title>/i, `<title>${SOCIAL_PREVIEW_TITLE}</title>`);
  result = result.replace(/<!-- SIHSALUS social preview -->[\s\S]*?<!-- \/SIHSALUS social preview -->\s*/g, '');
  result = result.replace('</head>', `${tags}</head>`);
  return result;
}

module.exports = {
  SOCIAL_PREVIEW_DESCRIPTION,
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
};
