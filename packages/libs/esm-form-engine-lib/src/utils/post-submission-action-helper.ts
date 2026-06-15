import jsep from 'jsep';

import { type OpenmrsEncounter } from '../types';
import { getResourceUuid, isPlainObject, isStringValue } from './common-utils';

type ExpressionContext = Record<string, unknown>;

const forbiddenProps = new Set(['__proto__', 'constructor', 'prototype']);

export function evaluatePostSubmissionExpression(expression: string, encounters: OpenmrsEncounter[]): boolean {
  const encounter = encounters[0];
  const regx = /(?:\w+|'(?:\\'|[^'\n])*')/g;
  let match: RegExpExecArray | null;
  const fieldIds = new Set<string>();
  try {
    match = regx.exec(expression);
    while (match) {
      const value = match[0].replace(/\\'/g, "'"); // Replace escaped single quotes

      const isBoolean = /^(true|false)$/i.test(value);
      const isNumber = /^-?\d+$/.test(value);
      const isFloat = /^-?\d+\.\d+$/.test(value);

      if (
        !(value.startsWith("'") && value.endsWith("'")) &&
        typeof value === 'string' &&
        !isBoolean &&
        !isNumber &&
        !isFloat
      ) {
        fieldIds.add(value);
      }
      match = regx.exec(expression);
    }

    const fieldToValueMap = fieldIds.size ? getFieldValues(fieldIds, encounter) : {};
    return safeEvaluateExpression(expression, fieldToValueMap);
  } catch (error) {
    throw new Error('Error evaluating expression', { cause: error });
  }
}

function getFieldValues(fieldIds: Set<string>, encounter: OpenmrsEncounter | undefined): ExpressionContext {
  const result: ExpressionContext = {};
  fieldIds.forEach((fieldId) => {
    const rawValue = encounter?.obs?.find((item) => item.formFieldPath?.includes(fieldId))?.value;
    let value: unknown;
    if (isPlainObject(rawValue)) {
      value = getResourceUuid(rawValue);
    } else {
      value = formatValue(rawValue);
    }
    result[fieldId] = value;
  });

  return result;
}

function formatValue(value: unknown): string | number | boolean | undefined {
  if (isStringValue(value)) {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return undefined;
}

function safeEvaluateExpression(expression: string, context: ExpressionContext): boolean {
  if (!expression || expression.length > 500) {
    return false;
  }
  return Boolean(evaluateNode(jsep(expression), context));
}

function evaluateNode(node: jsep.Expression, context: ExpressionContext): unknown {
  switch (node.type) {
    case 'Literal':
      return (node as jsep.Literal).value;
    case 'Identifier': {
      const name = (node as jsep.Identifier).name;
      if (name === 'undefined') return undefined;
      if (name === 'null') return null;
      if (name === 'true') return true;
      if (name === 'false') return false;
      return Object.hasOwn(context, name) ? context[name] : undefined;
    }
    case 'MemberExpression': {
      const member = node as jsep.MemberExpression;
      const object = evaluateNode(member.object, context);
      if (object == null) return undefined;
      const property = member.computed
        ? evaluateNode(member.property, context)
        : (member.property as jsep.Identifier).name;
      if (typeof property === 'string' && forbiddenProps.has(property)) return undefined;
      if (typeof property === 'string' || typeof property === 'number') {
        return (object as Record<string | number, unknown>)[property];
      }
      return undefined;
    }
    case 'BinaryExpression': {
      const binary = node as jsep.BinaryExpression;
      if (binary.operator === '&&') {
        const left = evaluateNode(binary.left, context);
        return left ? evaluateNode(binary.right, context) : left;
      }
      if (binary.operator === '||') {
        const left = evaluateNode(binary.left, context);
        return left ? left : evaluateNode(binary.right, context);
      }
      const left = evaluateNode(binary.left, context);
      const right = evaluateNode(binary.right, context);
      switch (binary.operator) {
        case '===':
          return left === right;
        case '!==':
          return left !== right;
        case '==':
          return looseEqual(left, right);
        case '!=':
          return !looseEqual(left, right);
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
      const unary = node as jsep.UnaryExpression;
      const value = evaluateNode(unary.argument, context);
      if (unary.operator === '!') return !value;
      if (unary.operator === '-') return -(value as number);
      return false;
    }
    case 'ConditionalExpression': {
      const conditional = node as jsep.ConditionalExpression;
      return evaluateNode(conditional.test, context)
        ? evaluateNode(conditional.consequent, context)
        : evaluateNode(conditional.alternate, context);
    }
    case 'ArrayExpression': {
      const array = node as jsep.ArrayExpression;
      return array.elements.map((element) => (element ? evaluateNode(element, context) : undefined));
    }
    default:
      return undefined;
  }
}

function looseEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if ((left === null && right === undefined) || (left === undefined && right === null)) return true;
  if (
    (typeof left === 'number' || typeof left === 'string' || typeof left === 'boolean') &&
    (typeof right === 'number' || typeof right === 'string' || typeof right === 'boolean')
  ) {
    return String(left) === String(right);
  }
  return false;
}
