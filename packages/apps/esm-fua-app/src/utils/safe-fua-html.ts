import DOMPurify from 'dompurify';

const staticDocumentPolicy = [
  "default-src 'none'",
  'img-src data:',
  "style-src 'unsafe-inline'",
  'font-src data:',
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "object-src 'none'",
].join('; ');

const allowedTags = [
  'address',
  'article',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'col',
  'colgroup',
  'dd',
  'div',
  'dl',
  'dt',
  'em',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'li',
  'main',
  'ol',
  'p',
  'pre',
  'section',
  'small',
  'span',
  'strong',
  'style',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
] as const;

const allowedTagNames = new Set<string>(allowedTags);
const allowedAttributes = new Set([
  'alt',
  'aria-label',
  'aria-labelledby',
  'class',
  'colspan',
  'dir',
  'height',
  'id',
  'lang',
  'role',
  'rowspan',
  'scope',
  'style',
  'title',
  'width',
]);

const enforceStaticAllowlist = (fragment: DocumentFragment) => {
  fragment.querySelectorAll('*').forEach((element) => {
    const tagName = element.tagName.toLowerCase();
    if (!allowedTagNames.has(tagName)) {
      element.remove();
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const attributeName = attribute.name.toLowerCase();
      const isEmbeddedImage =
        tagName === 'img' && attributeName === 'src' && /^data:image\//i.test(attribute.value.trim());
      if (!allowedAttributes.has(attributeName) && !isEmbeddedImage) {
        element.removeAttribute(attribute.name);
      }
    });
  });
};

/**
 * FUA renderers return a complete HTML document. Treat that document as
 * untrusted even when it comes from our backend: it contains clinical data and
 * must remain a static, offline representation.
 */
export const prepareSafeFuaHtml = (html: string): string => {
  const template = document.createElement('template');
  template.innerHTML = html;
  enforceStaticAllowlist(template.content);
  const sanitizedHtml = DOMPurify.sanitize(template.innerHTML, {
    ALLOWED_ATTR: [...allowedAttributes, 'src'],
    ALLOWED_TAGS: [...allowedTags],
    ALLOWED_URI_REGEXP: /^data:image\//i,
  });

  return (
    '<!doctype html>\n<html><head>' +
    `<meta http-equiv="Content-Security-Policy" content="${staticDocumentPolicy}">` +
    `</head><body>${sanitizedHtml}</body></html>`
  );
};

export const loadSafeFuaHtmlInWindow = (targetWindow: Window, html: string) => {
  const url = URL.createObjectURL(new Blob([prepareSafeFuaHtml(html)], { type: 'text/html' }));
  targetWindow.opener = null;
  targetWindow.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
  targetWindow.location.replace(url);
};
