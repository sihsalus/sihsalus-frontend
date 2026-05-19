type Globals = Record<string, unknown>;

export const globals: Globals = {
  Array,
  Boolean,
  Symbol,
  Infinity,
  NaN,
  Math,
  Number,
  BigInt,
  String,
  RegExp,
  JSON,
  isFinite,
  isNaN,
  parseFloat,
  parseInt,
  decodeURI,
  encodeURI,
  encodeURIComponent,
  Object: {
    ['__proto__']: null,
    assign: Object.assign.bind(Object),
    fromEntries: Object.fromEntries.bind(Object),
    hasOwn: Object.hasOwn.bind(Object),
    keys: Object.keys.bind(Object),
    is: Object.is.bind(Object),
    values: Object.values.bind(Object),
  },
};

export const globalsAsync: Globals = {
  ...globals,
  Promise,
};
