/**
 * Safe expression evaluator — AST-based, no `new Function()`.
 *
 * Uses jsep to parse expressions into an AST, then walks the AST with
 * a strict allowlist of operations. No arbitrary code can execute regardless
 * of the expression content (no blocklist bypass via unicode/hex escapes, etc.).
 *
 * Supported expression patterns (for showWhenExpression configs):
 *   - Property access:  `patient.birthDate`, `visitAttributes['uuid']`
 *   - Method calls:     `enrollment.includes('HIV')`, `programUuids.includes('uuid')`
 *   - Comparisons:      `===`, `!==`, `==`, `!=`, `>`, `<`, `>=`, `<=`
 *   - Arithmetic:       `+`, `-`
 *   - Logical:          `&&`, `||`, `!`
 *   - Ternary:          `a ? b : c`
 *   - Array literals:   `['a', 'b']`
 *   - Literals:         strings, numbers, booleans, null, undefined
 */
import jsep from 'jsep';

type JsepNode = jsep.Expression;

/** Properties that must never be accessed to prevent prototype-chain escapes. */
const FORBIDDEN_PROPS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
]);

/** Methods allowed to be called on context values (Array / String builtins only). */
const ALLOWED_METHODS = new Set([
  'includes',
  'startsWith',
  'endsWith',
  'indexOf',
  'lastIndexOf',
  'some',
  'every',
  'find',
  'findIndex',
  'filter',
  'map',
  'toString',
  'toLowerCase',
  'toUpperCase',
  'trim',
  'trimStart',
  'trimEnd',
  'split',
  'join',
  'slice',
]);

function evalNode(node: JsepNode, context: Record<string, unknown>): unknown {
  switch (node.type) {
    case 'Literal':
      return (node as jsep.Literal).value;

    case 'Identifier': {
      const name = (node as jsep.Identifier).name;
      // Treat bare keywords as their literal values
      if (name === 'undefined') return undefined;
      if (name === 'null') return null;
      if (name === 'true') return true;
      if (name === 'false') return false;
      if (Object.hasOwn(context, name)) return context[name];
      return undefined;
    }

    case 'MemberExpression': {
      const me = node as jsep.MemberExpression;
      const obj = evalNode(me.object, context);
      if (obj == null) return undefined;
      const prop = me.computed ? evalNode(me.property, context) : (me.property as jsep.Identifier).name;
      if (typeof prop === 'string' && FORBIDDEN_PROPS.has(prop)) return undefined;
      if (typeof prop === 'string' || typeof prop === 'number') {
        return (obj as Record<string | number, unknown>)[prop];
      }
      return undefined;
    }

    case 'CallExpression': {
      const ce = node as jsep.CallExpression;
      // Only allow method calls, not free function calls (e.g. eval(), fetch())
      if (ce.callee.type !== 'MemberExpression') return undefined;
      const callee = ce.callee as jsep.MemberExpression;
      // Disallow computed method names (e.g. obj['eval']())
      if (callee.computed) return undefined;
      const methodName = (callee.property as jsep.Identifier).name;
      if (!ALLOWED_METHODS.has(methodName)) return undefined;
      const obj = evalNode(callee.object, context);
      if (obj == null) return undefined;
      const method = (obj as Record<string, unknown>)[methodName];
      if (typeof method !== 'function') return undefined;
      const args = ce.arguments.map((arg) => evalNode(arg, context));
      return (method as (...a: unknown[]) => unknown).apply(obj, args);
    }

    case 'BinaryExpression': {
      const be = node as jsep.BinaryExpression;
      // jsep parses && and || as BinaryExpression — handle with short-circuit
      if (be.operator === '&&') {
        const left = evalNode(be.left, context);
        return left ? evalNode(be.right, context) : left;
      }
      if (be.operator === '||') {
        const left = evalNode(be.left, context);
        return left ? left : evalNode(be.right, context);
      }
      const left = evalNode(be.left, context);
      const right = evalNode(be.right, context);
      switch (be.operator) {
        case '===':
          return left === right;
        case '!==':
          return left !== right;
        case '==':
          // biome-ignore lint/suspicious/noDoubleEquals: Implements expression-language loose equality for the == operator.
          return left == right;
        case '!=':
          // biome-ignore lint/suspicious/noDoubleEquals: Implements expression-language loose inequality for the != operator.
          return left != right;
        case '>':
          return (left as number) > (right as number);
        case '<':
          return (left as number) < (right as number);
        case '>=':
          return (left as number) >= (right as number);
        case '<=':
          return (left as number) <= (right as number);
        case '+':
          return (left as number) + (right as number);
        case '-':
          return (left as number) - (right as number);
        default:
          return false;
      }
    }

    case 'UnaryExpression': {
      const ue = node as jsep.UnaryExpression;
      const arg = evalNode(ue.argument, context);
      if (ue.operator === '!') return !arg;
      if (ue.operator === '-') return -(arg as number);
      return false;
    }

    case 'ConditionalExpression': {
      const cond = node as jsep.ConditionalExpression;
      return evalNode(cond.test, context) ? evalNode(cond.consequent, context) : evalNode(cond.alternate, context);
    }

    case 'ArrayExpression': {
      const ae = node as jsep.ArrayExpression;
      return ae.elements.map((el) => (el ? evalNode(el, context) : undefined));
    }

    default:
      return undefined;
  }
}

/**
 * Evaluates a simple expression string against a provided context object.
 * Returns `false` on any error, unsupported construct, or expression > 500 chars.
 * Returns `true` when expression is empty/null (treat as "show always").
 */
export function safeEvaluateExpression(expression: string, context: Record<string, unknown>): boolean {
  try {
    if (!expression || typeof expression !== 'string') return true;
    if (expression.length > 500) {
      console.error('[expression-evaluator] Expression rejected (too long)');
      return false;
    }
    const ast = jsep(expression);
    return Boolean(evalNode(ast, context));
  } catch (error) {
    console.error(`[expression-evaluator] Failed to evaluate "${expression}":`, error);
    return false;
  }
}
