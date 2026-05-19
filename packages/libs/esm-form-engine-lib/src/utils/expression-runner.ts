import {
  compile,
  type DefaultEvaluateReturnType,
  evaluateAsType,
  evaluateAsTypeAsync,
  extractVariableNames,
  type VariablesMap,
  type Visit,
} from '@openmrs/esm-framework/src/internal';
import { isEmpty } from 'lodash-es';
import { HistoricalDataSourceService } from '../datasources/historical-data-source';
import { getRegisteredExpressionHelpers } from '../registry/registry';
import { type FormField, type FormPage, type FormSection, type OpenmrsEncounter } from '../types';
import { CommonExpressionHelpers, registerDependency, simpleHash } from './common-expression-helpers';

export interface FormNode {
  value: FormPage | FormSection | FormField;
  type: 'field' | 'page' | 'section';
}

function isFieldNode(node: FormNode): node is FormNode & { type: 'field'; value: FormField } {
  return node.type === 'field';
}

export interface ExpressionContext {
  mode: 'enter' | 'edit' | 'view' | 'embedded-view';
  myValue?: unknown;
  patient: ExpressionPatient | null;
  previousEncounter?: OpenmrsEncounter;
  visit?: Visit;
}

export interface ExpressionPatient extends fhir.Patient {
  age?: number;
  sex?: string;
  birthDate?: string;
}

export type EvaluateReturnType = DefaultEvaluateReturnType | Record<string, unknown>;

export const astCache = new Map<number, ReturnType<typeof compile>>();

function typePredicate(result: unknown): result is EvaluateReturnType {
  return (
    typeof result === 'string' ||
    typeof result === 'number' ||
    typeof result === 'boolean' ||
    typeof result === 'undefined' ||
    typeof result === 'object' // Support for null and arbitrary objects
  );
}

export function evaluateExpression(
  expression: string,
  node: FormNode,
  fields: Array<FormField>,
  fieldValues: Record<string, unknown>,
  context: ExpressionContext,
): EvaluateReturnType | null {
  if (!expression?.trim()) {
    return null;
  }
  const compiledExpression = getExpressionAst(expression);
  // track dependencies
  trackFieldDependencies(compiledExpression, node, fields);
  try {
    return evaluateAsType(compiledExpression, getEvaluationContext(node, fields, fieldValues, context), typePredicate);
  } catch (error) {
    console.error(`Error: ${error} \n\n failing expression: ${expression}`);
  }
  return null;
}

export async function evaluateAsyncExpression(
  expression: string,
  node: FormNode,
  fields: Array<FormField>,
  fieldValues: Record<string, unknown>,
  context: ExpressionContext,
): Promise<EvaluateReturnType | null> {
  if (!expression?.trim()) {
    return null;
  }

  const compiledExpression = getExpressionAst(expression);
  // track dependencies
  trackFieldDependencies(compiledExpression, node, fields);
  try {
    return evaluateAsTypeAsync(
      compiledExpression,
      getEvaluationContext(node, fields, fieldValues, context),
      typePredicate,
    );
  } catch (error) {
    console.error(`Error: ${error} \n\n failing expression: ${expression}`);
  }
  return null;
}

function getEvaluationContext(
  node: FormNode,
  formFields: FormField[],
  fieldValues: Record<string, unknown>,
  context: ExpressionContext,
): VariablesMap {
  const { patient } = context;
  let { myValue } = context;
  const { sex, age } = patient ?? {};

  if (isFieldNode(node) && myValue === undefined) {
    myValue = fieldValues[node.value.id];
  }

  const HD = new HistoricalDataSourceService();
  interface PreviousEncounterState {
    value: OpenmrsEncounter;
    getValue: (concept: string) => unknown;
  }

  const previousEncounterState: PreviousEncounterState = {
    value: context.previousEncounter ?? { obs: [] },
    getValue: (concept: string): unknown =>
      previousEncounterState.value.obs?.find(
        (obs) => typeof obs.concept === 'object' && obs.concept !== null && obs.concept.uuid === concept,
      ),
  };

  HD.putObject('prevEnc', previousEncounterState);

  const visit: Visit = context?.visit ?? ({} as Visit);
  const visitType = visit?.visitType || { uuid: '' };
  const visitTypeUuid = visitType.uuid ?? '';

  const _ = {
    isEmpty,
  };

  return {
    ...new CommonExpressionHelpers(node, patient, formFields, fieldValues),
    ...getRegisteredExpressionHelpers(),
    ...context,
    ...fieldValues,
    patient,
    myValue,
    sex,
    age,
    HD,
    visit,
    visitType,
    visitTypeUuid,
    _,
  } as VariablesMap;
}

/**
 * Compiles an expression into an abstract syntax tree (AST) and caches the result.
 * @param expression - The expression to compile.
 * @returns The abstract syntax tree (AST) of the compiled expression.
 */
function getExpressionAst(expression: string): ReturnType<typeof compile> {
  const hash = simpleHash(expression);
  const cachedAst = astCache.get(hash);
  if (cachedAst) {
    return cachedAst;
  }
  const ast = compile(expression);
  astCache.set(hash, ast);
  return ast;
}

/**
 * Extracts all referenced fields in the expression and registers them as dependencies.
 * @param expression - The expression to track dependencies for.
 * @param fieldNode - The node representing the field.
 * @param allFields - The list of all fields in the form.
 */
export function trackFieldDependencies(
  expression: ReturnType<typeof compile>,
  fieldNode: FormNode,
  allFields: FormField[],
): void {
  const variables = extractVariableNames(expression);

  for (const variable of variables) {
    const field = allFields.find((field) => field.id === variable);
    if (field) {
      registerDependency(fieldNode, field);
    }
  }
}
