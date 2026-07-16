const spaStaticAssetContentTypes = new Map([['.avif', 'image/avif']]);

function setSpaStaticAssetHeaders(response, filePath) {
  const extensionStart = filePath.lastIndexOf('.');
  const extension = extensionStart === -1 ? '' : filePath.slice(extensionStart).toLowerCase();
  const contentType = spaStaticAssetContentTypes.get(extension);

  if (contentType) {
    response.setHeader('Content-Type', contentType);
  }
}

function createSpaStaticOptions(options = {}) {
  const configuredSetHeaders = options.setHeaders;

  return {
    ...options,
    setHeaders(response, filePath, stat) {
      if (typeof configuredSetHeaders === 'function') {
        configuredSetHeaders(response, filePath, stat);
      }
      setSpaStaticAssetHeaders(response, filePath);
    },
  };
}

function isSpaIndexRequestPath(requestPath, spaPath) {
  const normalizedSpaPath = spaPath.replace(/\/+$/, '');
  const pathname = (() => {
    try {
      return new URL(requestPath, 'http://localhost').pathname;
    } catch {
      return requestPath.split(/[?#]/)[0];
    }
  })();

  if (
    pathname === normalizedSpaPath ||
    pathname === `${normalizedSpaPath}/` ||
    pathname === `${normalizedSpaPath}/index.html`
  ) {
    return true;
  }
  if (!pathname.startsWith(`${normalizedSpaPath}/`)) {
    return false;
  }

  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  return !lastSegment.includes('.');
}

module.exports = { createSpaStaticOptions, isSpaIndexRequestPath, setSpaStaticAssetHeaders };
