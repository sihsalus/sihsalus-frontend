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

const isSafePrototype = (prototype: unknown) => prototype === null || prototype === Object.prototype;
const assertSafePrototype = (prototype: unknown, operation: string) => {
  if (!isSafePrototype(prototype)) {
    throw new TypeError(`Object.${operation} only supports null or Object.prototype`);
  }
};

const assertSafePropertyKey = (property: PropertyKey, operation: string) => {
  if (property === '__proto__' || property === 'prototype' || property === 'constructor') {
    throw new TypeError(`Object.${operation} does not allow defining reserved property "${String(property)}"`);
  }
};

const safeObjectCreate = (prototype: object | null, properties?: PropertyDescriptorMap & ThisType<unknown>) => {
  assertSafePrototype(prototype, 'create');
  return properties ? Object.create(prototype, properties) : Object.create(prototype);
};

const safeObjectDefineProperty = <T extends object>(
  object: T,
  property: PropertyKey,
  attributes: PropertyDescriptor & ThisType<unknown>,
) => {
  assertSafePropertyKey(property, 'defineProperty');
  assertSafePrototype(Object.getPrototypeOf(object), 'defineProperty');
  return Object.defineProperty(object, property, attributes);
};

const safeObjectSetPrototypeOf = <T extends object>(object: T, prototype: object | null) => {
  assertSafePrototype(prototype, 'setPrototypeOf');
  assertSafePrototype(Object.getPrototypeOf(object), 'setPrototypeOf');
  return Object.setPrototypeOf(object, prototype);
};

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
    create: safeObjectCreate,
    defineProperty: safeObjectDefineProperty,
    fromEntries: Object.fromEntries.bind(Object),
    getPrototypeOf: Object.getPrototypeOf.bind(Object),
    hasOwn: Object.hasOwn.bind(Object),
    keys: Object.keys.bind(Object),
    is: Object.is.bind(Object),
    setPrototypeOf: safeObjectSetPrototypeOf,
    values: Object.values.bind(Object),
  },
};

export const globalsAsync: Globals = {
  ...globals,
  Promise,
};
