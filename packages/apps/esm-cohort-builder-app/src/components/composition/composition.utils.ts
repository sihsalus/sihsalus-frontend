import { cloneDeep } from 'lodash-es';
import { addColumnsToDisplay } from '../../cohort-builder.utils';
import { getStoredSearchHistoryEntry } from '../../search-history-store';
import type { Query } from '../../types';

// Keep unknown tokens so invalid text cannot be silently discarded.
const tokenizeComposition = (search: string) => search.match(/\d+|[a-z]+|[^\s]/gi) ?? [];

const isHistoryReference = (token: string) => /^[1-9]\d*$/.test(token) && Number.isSafeInteger(Number(token));

const areCompositionTokensValid = (tokens: string[]) => {
  let expectsOperand = true;
  let parentheses = 0;

  for (const token of tokens) {
    const operator = token.toUpperCase();
    if (expectsOperand) {
      if (token === '(') {
        parentheses++;
      } else if (isHistoryReference(token)) {
        expectsOperand = false;
      } else if (operator !== 'NOT' && token !== '!') {
        return false;
      }
    } else if (token === ')' && parentheses > 0) {
      parentheses--;
    } else if (['AND', 'OR', 'UNION', 'INTERSECTION', '+'].includes(operator)) {
      expectsOperand = true;
    } else {
      return false;
    }
  }

  return !expectsOperand && parentheses === 0;
};

export const isCompositionValid = (search: string) => areCompositionTokensValid(tokenizeComposition(search));

const formatFilterCombination = (filterText: string, numberOfSearches: number) => {
  return filterText.replace(/\d+/g, (reference) => (Number(reference) + numberOfSearches).toString());
};

export const createCompositionQuery = (compositionQuery: string) => {
  const searchTokens = tokenizeComposition(compositionQuery);
  if (!areCompositionTokensValid(searchTokens)) {
    throw new Error('Invalid composition syntax');
  }

  const query: Query = {
    type: 'org.openmrs.module.reporting.dataset.definition.PatientDataSetDefinition',
    columns: addColumnsToDisplay(),
    rowFilters: [],
    customRowFilterCombination: '',
  };

  query.customRowFilterCombination = searchTokens
    .map((eachToken) => {
      if (isHistoryReference(eachToken)) {
        const operandQuery = getStoredSearchHistoryEntry(parseInt(eachToken, 10) - 1);

        if (!operandQuery?.parameters) {
          throw new Error(`Search history entry ${eachToken} was not found`);
        }

        const jsonRequestObject = operandQuery.parameters;
        const combination = formatFilterCombination(
          jsonRequestObject.customRowFilterCombination,
          query.rowFilters.length,
        );
        query.rowFilters = query.rowFilters.concat(cloneDeep(jsonRequestObject.rowFilters));
        return `(${combination})`;
      }

      return eachToken;
    })
    .join(' ');

  return { query };
};
