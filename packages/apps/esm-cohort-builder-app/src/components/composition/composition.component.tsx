import { TextInput } from '@carbon/react';
import { showSnackbar } from '@openmrs/esm-framework';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SearchByProps } from '../../types';
import SearchButtonSet from '../search-button-set/search-button-set';
import styles from './composition.style.css';
import { createCompositionQuery, isCompositionValid } from './composition.utils';

const Composition: React.FC<SearchByProps> = ({ onSubmit }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [compositionQuery, setCompositionQuery] = useState('');
  const [description, setDescription] = useState('');

  const handleResetInputs = () => {
    setDescription('');
    setCompositionQuery('');
  };

  const handleCompositionQuery = (composition: string) => {
    setCompositionQuery(composition);
    setDescription(t('compositionOf', 'Composition of {{composition}}', { composition }));
  };

  const submit = async () => {
    setIsLoading(true);
    try {
      if (isCompositionValid(compositionQuery)) {
        const searchParams = createCompositionQuery(compositionQuery);
        await onSubmit(searchParams, description);
      } else {
        showSnackbar({
          title: t('error', 'Error!'),
          kind: 'error',
          isLowContrast: true,
          subtitle: t('invalidComposition', 'Composition is not valid'),
        });
      }
      setIsLoading(false);
    } catch (_error) {
      setIsLoading(false);
      showSnackbar({
        title: t('error', 'Error!'),
        kind: 'error',
        isLowContrast: true,
        subtitle: t('invalidComposition', 'Composition is not valid'),
      });
    }
  };

  return (
    <>
      <TextInput
        labelText={t('composition', 'Composition')}
        helperText={t(
          'compositionSyntaxHelp',
          'Use search history numbers, AND, OR, NOT and parentheses. Example: (1 OR 2) AND NOT 3.',
        )}
        data-testid="composition-query"
        id="composition-query"
        onChange={(e) => handleCompositionQuery(e.target.value)}
        value={compositionQuery}
      />
      <br />
      <TextInput
        labelText={t('description', 'Description')}
        data-testid="composition-description"
        id="composition-description"
        onChange={(e) => setDescription(e.target.value)}
        value={description}
      />
      <br />
      <p className={styles.text}>
        {t(
          'compositionExplanationOne',
          'A composition query combines together the results of multiple cohorts using the logical operators: AND, OR and NOT.',
        )}
      </p>
      <br />
      <p className={styles.text}>
        {t(
          'compositionExplanationTwo',
          'To use this query you need to already have query results in your search history. Those existing query results can then be combined to yield the results of the composition query.',
        )}
      </p>
      <br />
      <p className={styles.text}>
        {t(
          'compositionExplanationThree',
          "Example: if the search history #1 is a cohort of patients who are males, and if the search history #2 is a cohort of patients with ages between 23 and 35 years; then '1 AND 2' will result in a cohort of patients who are males with ages between 23 and 35 years.",
        )}
      </p>
      <br />
      <SearchButtonSet onHandleReset={handleResetInputs} onHandleSubmit={submit} isLoading={isLoading} />
    </>
  );
};

export default Composition;
