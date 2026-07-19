import { Dropdown, StructuredListSkeleton } from '@carbon/react';
import { useLayoutType, type VisitType } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import styles from './base-visit-type.scss';
import { type VisitFormData } from './visit-form.resource';

interface BaseVisitTypeProps {
  visitTypes: Array<VisitType>;
}

const BaseVisitType: React.FC<BaseVisitTypeProps> = ({ visitTypes }) => {
  const { t } = useTranslation();
  const { control } = useFormContext<VisitFormData>();
  const isTablet = useLayoutType() === 'tablet';

  return (
    <div className={classNames(styles.visitTypeOverviewWrapper, isTablet ? styles.tablet : styles.desktop)}>
      {visitTypes.length ? (
        <Controller
          name="visitType"
          control={control}
          defaultValue={visitTypes.length === 1 ? visitTypes[0].uuid : ''}
          render={({ field: { onChange, value } }) => (
            <Dropdown
              id="visit-type"
              items={visitTypes}
              itemToString={(item) => item?.display ?? ''}
              label={t('selectVisitType', 'Seleccione un tipo de atención')}
              onChange={({ selectedItem }) => onChange(selectedItem?.uuid ?? '')}
              selectedItem={visitTypes.find((visitType) => visitType.uuid === value) ?? null}
              titleText={`${t('visitType', 'Tipo de atención')} *`}
            />
          )}
        />
      ) : (
        <StructuredListSkeleton className={styles.skeleton} />
      )}
    </div>
  );
};

export default BaseVisitType;
