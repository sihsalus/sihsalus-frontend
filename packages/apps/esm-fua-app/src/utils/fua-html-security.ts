import DOMPurify, { type UponSanitizeAttributeHook } from 'dompurify';

const inertDocumentCsp = [
  "default-src 'none'",
  "img-src data:",
  "style-src 'unsafe-inline'",
  'font-src data:',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const networkAttributeNames = new Set([
  'action',
  'background',
  'cite',
  'data',
  'formaction',
  'href',
  'poster',
  'src',
  'srcset',
  'xlink:href',
]);

const escapeHtml = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const createStaticDocument = (body: string) => {
  const escapedCsp = inertDocumentCsp.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  return `<!doctype html>\n<html><head><meta http-equiv="Content-Security-Policy" content="${escapedCsp}"></head><body>${body}</body></html>`;
};

function isLoopbackHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

/**
 * FUA identifiers are clinical data. Only a same-origin HTTPS gateway may
 * receive them. Loopback HTTP remains available for local development.
 */
export function resolveTrustedFuaEndpoint(endpoint: string | null | undefined, applicationOrigin: string) {
  const value = endpoint?.trim();
  if (!value) {
    return null;
  }

  try {
    const origin = new URL(applicationOrigin);
    const resolvedEndpoint = new URL(value, origin.origin);
    const isSecureTransport =
      resolvedEndpoint.protocol === 'https:' ||
      (resolvedEndpoint.protocol === 'http:' && isLoopbackHostname(resolvedEndpoint.hostname));

    if (
      !isSecureTransport ||
      resolvedEndpoint.origin !== origin.origin ||
      resolvedEndpoint.username ||
      resolvedEndpoint.password ||
      resolvedEndpoint.hash
    ) {
      return null;
    }

    return resolvedEndpoint;
  } catch {
    return null;
  }
}

/**
 * Render generator HTML as a static document. The iframe is also sandboxed,
 * but stripping active/network-capable markup and injecting a restrictive CSP
 * prevents the document itself from exfiltrating patient data.
 */
export function createInertFuaHtml(html: string) {
  const purifier = DOMPurify(window);
  if (!purifier.isSupported) {
    return createStaticDocument(escapeHtml(html));
  }

  const removeNetworkAttributes: UponSanitizeAttributeHook = (element, attribute) => {
    const attributeName = attribute.attrName.toLowerCase();
    const isEmbeddedRasterImage =
      element.tagName.toLowerCase() === 'img' &&
      attributeName === 'src' &&
      /^data:image\/(?:png|gif|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i.test(attribute.attrValue.trim());

    if (networkAttributeNames.has(attributeName) && !isEmbeddedRasterImage) {
      attribute.keepAttr = false;
    }
  };

  purifier.addHook('uponSanitizeAttribute', removeNetworkAttributes);
  let sanitizedHtml: string;
  try {
    sanitizedHtml = purifier.sanitize(html, {
      FORCE_BODY: true,
      FORBID_TAGS: [
        'script',
        'iframe',
        'object',
        'embed',
        'form',
        'link',
        'base',
        'meta',
        'audio',
        'video',
        'source',
        'track',
      ],
      RETURN_TRUSTED_TYPE: false,
    });
  } finally {
    purifier.removeHook('uponSanitizeAttribute', removeNetworkAttributes);
  }

  return createStaticDocument(sanitizedHtml);
}
