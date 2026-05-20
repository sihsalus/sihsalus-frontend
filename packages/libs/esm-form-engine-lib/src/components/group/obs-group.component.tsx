import { FormGroup } from '@carbon/react';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormProviderContext } from '../../provider/form-provider';
import { type FormFieldInputProps } from '../../types';
import { ErrorFallback, FormFieldRenderer, isGroupField } from '../renderer/field/form-field-renderer.component';
import styles from './obs-group.scss';

export const ObsGroup: React.FC<FormFieldInputProps> = ({ field, ...props }) => {
  const { t } = useTranslation();
  const { formFieldAdapters, formFields } = useFormProviderContext();

  const content = useMemo(
    () =>
      (field.questions ?? [])
        .map((child) => formFields.find((field) => field.id === child.id))
        .filter((child): child is typeof field => Boolean(child) && !child.isHidden)
        .map((child, index) => {
          const key = `${child.id}_${index}`;
          if (child.id === field.id) {
            return <ErrorFallback key={key} error={new Error('ObsGroup child has same id as parent question')} />;
          }

          if (child.type === 'obsGroup' && isGroupField(child.questionOptions.rendering)) {
            return (
              <div key={key} className={styles.nestedGroupContainer}>
                <ObsGroup {...props} field={child} />
              </div>
            );
          } else if (formFieldAdapters[child.type]) {
            return (
              <div className={classNames(styles.flexColumn)} key={key}>
                <div className={styles.groupContainer}>
                  <FormFieldRenderer fieldId={child.id} valueAdapter={formFieldAdapters[child.type]} />
                </div>
              </div>
            );
          }

          return null;
        }),
    [field, formFieldAdapters, formFields],
  );

  return (
    <div className={styles.groupContainer}>
      {content.length > 1 ? (
        <FormGroup legendText={t(field.label)} className={styles.boldLegend}>
          {content}
        </FormGroup>
      ) : (
        content
      )}
    </div>
  );
};

export default ObsGroup;
