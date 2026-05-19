type Globals = Record<string, unknown>;

const MAX_JSON_PARSE_INPUT_LENGTH = 100_000;

const safeJsonParse = (text: string, reviver?: (this: unknown, key: string, value: unknown) => unknown) => {
  if (typeof text !== 'string') {
    throw new TypeError('JSON.parse input must be a string');
  }

  if (text.length > MAX_JSON_PARSE_INPUT_LENGTH) {
    throw new Error(`JSON.parse input exceeds maximum allowed length of ${MAX_JSON_PARSE_INPUT_LENGTH} characters`);
  }

  return JSON.parse(text, reviver);
};

const SafeArray = Object.freeze({
  ['__proto__']: null,
  isArray: Array.isArray.bind(Array),
  from: Array.from.bind(Array),
  of: Array.of.bind(Array),
});

const regexConstructor = RegExp as RegExpConstructor & { escape?: (value: string) => string };
const SafeRegExp = Object.freeze({
  ['__proto__']: null,
  escape: regexConstructor.escape?.bind(RegExp),
});

const SafeSymbol = Object.freeze({
  ['__proto__']: null,
  for: Symbol.for.bind(Symbol),
  keyFor: Symbol.keyFor.bind(Symbol),
});

export const globals: Globals = {
  Array: SafeArray,
  Boolean,
  Symbol: SafeSymbol,
  Infinity,
  NaN,
  Math,
  Number,
  BigInt,
  String,
  RegExp: SafeRegExp,
  JSON: {
    ['__proto__']: null,
    parse: safeJsonParse,
    stringify: JSON.stringify.bind(JSON),
  },
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
    create: Object.create.bind(Object),
    defineProperty: Object.defineProperty.bind(Object),
    fromEntries: Object.fromEntries.bind(Object),
    getPrototypeOf: Object.getPrototypeOf.bind(Object),
    hasOwn: Object.hasOwn.bind(Object),
    keys: Object.keys.bind(Object),
    is: Object.is.bind(Object),
    setPrototypeOf: Object.setPrototypeOf.bind(Object),
    values: Object.values.bind(Object),
  },
};

export const globalsAsync: Globals = {
  ...globals,
  Promise,
};
