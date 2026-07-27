import DOMPurify from 'dompurify';
import type { DefaultTreeAdapterMap } from 'parse5';
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

const sanitizeStockMarkup = (content: string) =>
  DOMPurify.sanitize(content, {
    ALLOW_DATA_ATTR: false,
    ALLOWED_ATTR: [...allowedAttributes, 'src'],
    ALLOWED_TAGS: [...allowedTags],
    ALLOWED_URI_REGEXP: embeddedRasterImagePattern,
  });

type ParsedElement = DefaultTreeAdapterMap['element'];
type ParsedNode = DefaultTreeAdapterMap['node'];
type ParsedParentNode = DefaultTreeAdapterMap['parentNode'];

const structuralDocumentTags = new Set(['body', 'head', 'html']);

const escapeHtmlText = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const isParsedElement = (node: ParsedNode): node is ParsedElement => 'tagName' in node && 'attrs' in node;

const getParsedText = (node: ParsedNode): string => {
  if ('value' in node && typeof node.value === 'string') {
    return node.value;
  }
  return 'childNodes' in node ? node.childNodes.map(getParsedText).join('') : '';
};

const findParsedElement = (node: ParsedNode, tagName: string): ParsedElement | null => {
  if (isParsedElement(node) && node.tagName.toLowerCase() === tagName) {
    return node;
  }
  if ('childNodes' in node) {
    for (const child of node.childNodes) {
      const found = findParsedElement(child, tagName);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

/**
 * parse5 builds a detached syntax tree without creating browser elements,
 * fetching resources, or executing content. Strip every unsupported node and
 * attribute there before DOMPurify ever sees an HTML string.
 */
const enforceStaticAllowlist = (parent: ParsedParentNode, insideSvg = false): string | undefined => {
  let documentTitle: string | undefined;
  const retainedChildren: typeof parent.childNodes = [];

  for (const node of parent.childNodes) {
    if (!isParsedElement(node)) {
      retainedChildren.push(node);
      continue;
    }

    const tagName = node.tagName.toLowerCase();
    const isInsideSvg = insideSvg || tagName === 'svg';
    if (tagName === 'title' && !insideSvg) {
      documentTitle ??= getParsedText(node);
      continue;
    }

    if (!structuralDocumentTags.has(tagName) && !allowedTagNames.has(tagName)) {
      continue;
    }

    node.attrs = node.attrs.filter((attribute) => {
      const attributeName = attribute.name.toLowerCase();
      const attributeValue = attribute.value.trim();
      const isEmbeddedImage =
        tagName === 'img' && attributeName === 'src' && embeddedRasterImagePattern.test(attributeValue);
      const hasUnsafeCssUrl =
        /\burl\s*\(/i.test(attributeValue) && !/\burl\s*\(\s*#[A-Za-z0-9_-]+\s*\)/i.test(attributeValue);

      return (
        !attributeName.startsWith('on') &&
        !hasUnsafeCssUrl &&
        (allowedAttributeNames.has(attributeName) || isEmbeddedImage)
      );
    });

    const nestedTitle = enforceStaticAllowlist(node, isInsideSvg);
    documentTitle ??= nestedTitle;
    retainedChildren.push(node);
  }

  parent.childNodes = retainedChildren;
  return documentTitle;
};

/**
 * Stock fields are interpolated into printable HTML by the legacy report
 * formatters. Treat the complete document as untrusted: remarks, item names,
 * locations, titles, and SVG logos can all originate outside this bundle.
 */
export const prepareSafePrintHtml = async (content: string): Promise<string> => {
  const { parse, serialize } = await import('parse5');
  const parsedDocument = parse(content);
  const documentTitle = enforceStaticAllowlist(parsedDocument);
  const parsedBody = findParsedElement(parsedDocument, 'body');
  const sanitizedBody = sanitizeStockMarkup(parsedBody ? serialize(parsedBody) : '');

  return (
    '<!doctype html>\n<html><head>' +
    '<meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${staticPrintPolicy}">` +
    `<title>${escapeHtmlText(documentTitle ?? '')}</title>` +
    `<style>${PrintCss}</style>` +
    `</head><body>${sanitizedBody}</body></html>`
  );
};

const printDocumentInternal = async (content: string) => {
  const printDocument = new Blob([await prepareSafePrintHtml(content)], { type: 'text/html' });
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
    void printDocumentInternal(content);
  }, 300);
};
