import { Button, ButtonSet, Form, FormGroup, Select, SelectItem, Stack, TextInput } from '@carbon/react';
import { Save } from '@carbon/react/icons';
import {
  type DefaultWorkspaceProps,
  getCoreTranslation,
  restBaseUrl,
  showSnackbar,
  useConfig,
  useLayoutType,
} from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { type ChangeEvent, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConfigObject } from '../../config-schema';
import { type StockSource } from '../../core/api/types/stockOperation/StockSource';
import { useConcept } from '../../stock-lookups/stock-lookups.resource';
import { handleMutate } from '../../utils';
import { createOrUpdateStockSource } from '../stock-sources.resource';
import styles from './add-stock-sources.scss';

type AddStockSourceProps = DefaultWorkspaceProps & {
  model?: StockSource;
};

const StockSourcesAddOrUpdate: React.FC<AddStockSourceProps> = ({ model, closeWorkspace }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { stockSourceTypeUUID } = useConfig<ConfigObject>();

  // get stock sources
  const { items } = useConcept(stockSourceTypeUUID);

  const [formModel, setFormModel] = useState<StockSource>({ ...model });

  const onNameChanged = (evt: React.ChangeEvent<HTMLInputElement>): void => {
    if (model) {
      model.name = evt.target.value;
    }
    setFormModel({ ...formModel, name: evt.target.value });
  };

  const onAcronymChanged = (evt: React.ChangeEvent<HTMLInputElement>): void => {
    if (model) {
      model.acronym = evt.target.value;
    }
    setFormModel({ ...formModel, acronym: evt.target.value });
  };

  const onSourceTypeChange = (evt: ChangeEvent<HTMLSelectElement>) => {
    const selectedSourceType = items?.answers.find((x) => x.uuid === evt.target.value);
    setFormModel({ ...formModel, sourceType: selectedSourceType });
  };

  const handleSave = useCallback(
    (event) => {
      event.preventDefault();

      if (model) {
        formModel.uuid = model.uuid;
      }

      createOrUpdateStockSource(formModel)
        .then(
          () => {
            showSnackbar({
              isLowContrast: true,
              title: t('addedSource', 'Add Source'),
              kind: 'success',
              subtitle: t('stockSourceAddedSuccessfully', 'Stock source added successfully'),
            });

            handleMutate(`${restBaseUrl}/stockmanagement/stocksource`);

            closeWorkspace();
          },
          (error) => {
            showSnackbar({
              title: t('errorAddingSource', 'Error adding a source'),
              kind: 'error',
              isLowContrast: true,
              subtitle: error?.message,
            });
            closeWorkspace();
          },
        )
        .catch();
    },
    [formModel, model, t, closeWorkspace],
  );

  return (
    <Form className={styles.container}>
      <Stack className={styles.form} gap={5}>
        <FormGroup legendText={''}>
          <TextInput
            id="fullname"
            labelText={t('fullName', 'Full name')}
            onChange={onNameChanged}
            placeholder={t('sourceNamePlaceholder', 'e.g. CENARES')}
            size="md"
            type="text"
            value={model?.name}
          />
        </FormGroup>
        <FormGroup legendText={''}>
          <TextInput
            id="acronym"
            labelText={t('acronymOrCode', 'Acronym/Code')}
            onChange={onAcronymChanged}
            placeholder={t('sourceAcronymPlaceholder', 'e.g. DIGEMID')}
            size="md"
            type="text"
            value={model?.acronym}
          />
        </FormGroup>
        <Select
          name="sourceType"
          className="select-field"
          labelText={t('sourceType', 'Source type')}
          id="sourceType"
          value={formModel?.sourceType ? formModel.sourceType.uuid : ''}
          onChange={onSourceTypeChange}
        >
          <SelectItem disabled hidden value="" text={t('chooseSourceType', 'Choose a source type')} />
          {items?.answers?.map((sourceType) => (
            <SelectItem key={sourceType.uuid} value={sourceType.uuid} text={sourceType.display} />
          ))}
        </Select>
      </Stack>
      <ButtonSet
        className={classNames(styles.buttonSet, {
          [styles.tablet]: isTablet,
          [styles.desktop]: !isTablet,
        })}
      >
        <Button kind="secondary" onClick={() => closeWorkspace()} className={styles.button}>
          {getCoreTranslation('cancel')}
        </Button>
        <Button type="submit" className={styles.button} onClick={handleSave} kind="primary" renderIcon={Save}>
          {getCoreTranslation('save')}
        </Button>
      </ButtonSet>
    </Form>
  );
};

export default StockSourcesAddOrUpdate;
