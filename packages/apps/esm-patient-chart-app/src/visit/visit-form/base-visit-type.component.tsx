import { Dropdown, StructuredListSkeleton } from '@carbon/react';
import { useLayoutType, type VisitType } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import styles from './base-visit-type.scss';
import { type VisitFormData } from './visit-form.resource';

interface BaseVisitTypeProps {
  visitTypes: Array<VisitType>;
}

type VisitTypeOption = VisitType & {
  label: string;
};

type VisitTypeGroup = {
  label: string;
  options: Array<VisitTypeOption>;
};

const BaseVisitType: React.FC<BaseVisitTypeProps> = ({ visitTypes }) => {
  const { t } = useTranslation();
  const { control } = useFormContext<VisitFormData>();
  const isTablet = useLayoutType() === 'tablet';
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState('');

  const visitTypeGroups = useMemo<Array<VisitTypeGroup>>(() => {
    const groups = new Map<string, VisitTypeGroup>();

    visitTypes.forEach((visitType) => {
      const [category, detail] = visitType.display.split(' - ');
      const groupLabel = category.trim();

      if (!groups.has(groupLabel)) {
        groups.set(groupLabel, {
          label: groupLabel,
          options: [],
        });
      }

      const group = groups.get(groupLabel);
      const isGeneralOption = !detail;
      group.options.push({
        ...visitType,
        label: isGeneralOption ? t('withoutSpecialty', 'Sin especialidad') : detail.trim(),
      });
    });

    return Array.from(groups.values()).map((group) => ({
      ...group,
      options: group.options.sort((first, second) => {
        if (first.display === group.label) {
          return -1;
        }

        if (second.display === group.label) {
          return 1;
        }

        return first.label.localeCompare(second.label);
      }),
    }));
  }, [t, visitTypes]);

  const findSelectedGroup = (visitTypeUuid?: string) => {
    if (!visitTypeUuid) {
      return null;
    }

    return visitTypeGroups.find((group) => group.options.some((option) => option.uuid === visitTypeUuid)) ?? null;
  };

  const getDefaultOptionForGroup = (group: VisitTypeGroup) => {
    return group.options.find((option) => option.display === group.label) ?? group.options[0];
  };

  return (
    <div className={classNames(styles.visitTypeOverviewWrapper, isTablet ? styles.tablet : styles.desktop)}>
      {visitTypes.length ? (
        <Controller
          name="visitType"
          control={control}
          defaultValue={visitTypes.length === 1 ? visitTypes[0].uuid : ''}
          render={({ field: { onChange, value } }) => {
            const selectedGroup =
              findSelectedGroup(value) ??
              visitTypeGroups.find((group) => group.label === selectedCategoryLabel) ??
              null;
            const selectedOption = selectedGroup?.options.find((option) => option.uuid === value) ?? null;
            const showDetailSelector = selectedGroup && selectedGroup.options.length > 1;

            return (
              <div className={classNames(styles.dropdownGrid, { [styles.singleColumn]: !showDetailSelector })}>
                <Dropdown
                  id="visit-type-category"
                  items={visitTypeGroups}
                  itemToString={(item) => item?.label ?? ''}
                  label={t('selectVisitTypeCategory', 'Seleccione una categoría')}
                  onChange={({ selectedItem }) => {
                    if (!selectedItem) {
                      setSelectedCategoryLabel('');
                      onChange('');
                      return;
                    }

                    setSelectedCategoryLabel(selectedItem.label);
                    onChange(getDefaultOptionForGroup(selectedItem)?.uuid ?? '');
                  }}
                  selectedItem={selectedGroup}
                  titleText={`${t('visitTypeCategory', 'Categoría de consulta')} *`}
                />
                {showDetailSelector ? (
                  <Dropdown
                    id="visit-type-detail"
                    items={selectedGroup.options}
                    itemToString={(item) => item?.label ?? ''}
                    label={t('selectVisitTypeDetail', 'Seleccione un tipo')}
                    onChange={({ selectedItem }) => {
                      setSelectedCategoryLabel(selectedGroup.label);
                      onChange(selectedItem?.uuid ?? '');
                    }}
                    selectedItem={selectedOption}
                    titleText={`${t('visitTypeDetail', 'Tipo específico')} *`}
                  />
                ) : null}
              </div>
            );
          }}
        />
      ) : (
        <StructuredListSkeleton className={styles.skeleton} />
      )}
    </div>
  );
};

export default BaseVisitType;
