const { basename } = require('node:path');

module.exports = function hmrCompatLoader(source) {
  const exportName = basename(this.resourcePath, '.js');
  return `${source}\nmodule.exports.${exportName} = module.exports.${exportName} || module.exports;\n`;
};
