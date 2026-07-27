import DOMPurify from 'dompurify';
import { PrintCss } from './PrintStyles';

const staticPrintPolicy = [
  "default-src 'none'",
  "script-src 'none'",
  'img-src data:',
  "style-src 'unsafe-inline'",
  'font-src data:',
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "object-src 'none'",
].join('; ');

const allowedTags = [
  'b',
  'br',
  'circle',
  'clippath',
  'defs',
  'desc',
  'div',
  'ellipse',
  'em',
  'g',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'li',
  'line',
  'lineargradient',
  'ol',
  'p',
  'path',
  'polygon',
  'polyline',
  'rect',
  'small',
  'span',
  'stop',
  'strong',
  'sub',
  'sup',
  'svg',
  'table',
  'tbody',
  'td',
  'text',
  'tfoot',
  'th',
  'thead',
  'title',
  'tr',
  'tspan',
  'u',
  'ul',
] as const;

const allowedAttributes = [
  'alt',
  'aria-label',
  'aria-labelledby',
  'border',
  'cellpadding',
  'cellspacing',
  'class',
  'clip-path',
  'clip-rule',
  'colspan',
  'cx',
  'cy',
  'd',
  'dir',
  'dominant-baseline',
  'dx',
  'dy',
  'fill',
  'fill-opacity',
  'fill-rule',
  'font-family',
  'font-size',
  'height',
  'id',
  'lang',
  'opacity',
  'points',
  'preserveaspectratio',
  'r',
  'role',
  'rowspan',
  'rx',
  'ry',
  'scope',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'stroke-width',
  'style',
  'text-anchor',
  'title',
  'transform',
  'valign',
  'viewbox',
  'width',
  'x',
  'x1',
  'x2',
  'xmlns',
  'y',
  'y1',
  'y2',
] as const;

const allowedTagNames = new Set<string>(allowedTags);
const allowedAttributeNames = new Set<string>(allowedAttributes);
const embeddedRasterImagePattern = /^data:image\/(?:gif|jpe?g|png|webp);base64,[a-z0-9+/=\s]+$/i;

const escapeHtmlText = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const enforceStaticAllowlist = (fragment: DocumentFragment) => {
  fragment.querySelectorAll('*').forEach((element) => {
    const tagName = element.tagName.toLowerCase();
    if (!allowedTagNames.has(tagName)) {
      element.remove();
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const attributeName = attribute.name.toLowerCase();
      const attributeValue = attribute.value.trim();
      const isEmbeddedImage =
        tagName === 'img' && attributeName === 'src' && embeddedRasterImagePattern.test(attributeValue);
      const hasUnsafeCssUrl =
        /\burl\s*\(/i.test(attributeValue) && !/\burl\s*\(\s*#[A-Za-z0-9_-]+\s*\)/i.test(attributeValue);

      if (
        attributeName.startsWith('on') ||
        hasUnsafeCssUrl ||
        (!allowedAttributeNames.has(attributeName) && !isEmbeddedImage)
      ) {
        element.removeAttribute(attribute.name);
      }
    });
  });
};

/**
 * Stock fields are interpolated into printable HTML by the legacy report
 * formatters. Treat the complete document as untrusted: remarks, item names,
 * locations, titles, and SVG logos can all originate outside this bundle.
 */
export const prepareSafePrintHtml = (content: string): string => {
  const template = document.createElement('template');
  template.innerHTML = content;
  const documentTitle = Array.from(template.content.querySelectorAll('title')).find(
    (element) => !element.closest('svg'),
  )?.textContent;
  template.content.querySelectorAll('title').forEach((element) => {
    if (!element.closest('svg')) {
      element.remove();
    }
  });
  enforceStaticAllowlist(template.content);
  const sanitizedBody = DOMPurify.sanitize(template.innerHTML, {
    ALLOW_DATA_ATTR: false,
    ALLOWED_ATTR: [...allowedAttributes, 'src'],
    ALLOWED_TAGS: [...allowedTags],
    ALLOWED_URI_REGEXP: embeddedRasterImagePattern,
  });

  return (
    '<!doctype html>\n<html><head>' +
    '<meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${staticPrintPolicy}">` +
    `<title>${escapeHtmlText(documentTitle ?? '')}</title>` +
    `<style>${PrintCss}</style>` +
    `</head><body>${sanitizedBody}</body></html>`
  );
};

const printDocumentInternal = (content: string) => {
  const printDocument = new Blob([prepareSafePrintHtml(content)], { type: 'text/html' });
  const printUrl = URL.createObjectURL(printDocument);
  const newWin = window.open('', '_blank');
  if (newWin) {
    newWin.opener = null;
    newWin.addEventListener(
      'load',
      () => {
        const finishPrint = () => {
          URL.revokeObjectURL(printUrl);
          newWin.close();
        };
        newWin.addEventListener('afterprint', finishPrint, { once: true });
        try {
          newWin.print();
        } catch {
          finishPrint();
        }
      },
      { once: true },
    );
    newWin.location.replace(printUrl);
  } else {
    URL.revokeObjectURL(printUrl);
  }
};

export const printDocument = (content: string) => {
  setTimeout(() => {
    printDocumentInternal(content);
  }, 300);
};
