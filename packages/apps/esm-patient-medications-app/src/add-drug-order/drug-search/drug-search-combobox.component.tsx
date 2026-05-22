import { ComboBox } from '@carbon/react';
import { useDebounce, type Visit } from '@openmrs/esm-framework';
import { type DrugOrderBasketItem } from '@openmrs/esm-patient-common-lib';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { translateCarbonWithId } from '../carbon-translation';
import { getTemplateOrderBasketItem, useDrugSearch, useDrugTemplates } from './drug-search.resource';

interface DrugSearchComboBoxProps {
  initialOrderBasketItem: DrugOrderBasketItem;
  setSelectedDrugItem(drug: DrugOrderBasketItem): void;
  visit: Visit;
}

/**
 * This component is a ComboBox for searching for drugs. Similar to drug-search.component.tsx,
 * but allows for custom behavior when a drug is selected.
 * This component is currently not used anywhere in the patient-medications-app, but can be used
 * in the future for a drug form with an inlined drug search.
 */
const DrugSearchComboBox: React.FC<DrugSearchComboBoxProps> = ({
  initialOrderBasketItem,
  setSelectedDrugItem,
  visit,
}) => {
  const { t } = useTranslation();
  const [drugSearchTerm, setDrugSearchTerm] = useState('');
  const debouncedDrugSearchTerm = useDebounce(drugSearchTerm);
  const { drugs } = useDrugSearch(debouncedDrugSearchTerm);
  const { templateByDrugUuid } = useDrugTemplates(drugs);
  const drugItemTemplateOptions: Array<DrugOrderBasketItem> = useMemo(() => {
    return drugs?.flatMap((drug) => {
      const templates = templateByDrugUuid.get(drug.uuid);
      if (templates?.length > 0) {
        return templates.map((template) => getTemplateOrderBasketItem(drug, visit, template));
      } else {
        return [getTemplateOrderBasketItem(drug, visit)];
      }
    });
  }, [drugs, templateByDrugUuid, visit]);

  return (
    <ComboBox
      id="drug-search-combobox"
      items={drugItemTemplateOptions ?? []}
      onChange={({ selectedItem }) => {
        setSelectedDrugItem(selectedItem);
      }}
      initialSelectedItem={initialOrderBasketItem}
      onInputChange={(inputText) => {
        setDrugSearchTerm(inputText);
      }}
      itemToString={(item?: DrugOrderBasketItem | null) =>
        [item?.display, item?.drug?.strength?.toLowerCase(), item?.drug?.dosageForm?.display?.toLowerCase()]
          .filter(Boolean)
          .join(' — ')
      }
      placeholder={t('searchFieldPlaceholder', 'Search for a drug or orderset (e.g. "Aspirin")')}
      titleText={t('drugName', 'Drug name')}
      translateWithId={translateCarbonWithId}
    />
  );
};

export default DrugSearchComboBox;
