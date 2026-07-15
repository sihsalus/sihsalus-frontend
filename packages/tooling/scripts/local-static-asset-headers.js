const { extname } = require('node:path');

const localStaticAssetContentTypes = new Map([['.avif', 'image/avif']]);

function setLocalStaticAssetHeaders(response, filePath) {
  const contentType = localStaticAssetContentTypes.get(extname(filePath).toLowerCase());

  if (contentType) {
    response.setHeader('Content-Type', contentType);
  }
}

module.exports = { setLocalStaticAssetHeaders };
