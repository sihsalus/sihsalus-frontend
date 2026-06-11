import { renderingTypes, renderTypeOptions } from '@constants';
import type { RenderType } from '@sihsalus/esm-form-engine-lib';
import React from 'react';
import { useFormField } from '../../form-field-context';
import { DateInput, Markdown, NumberInput, SelectAnswers, Text, TextArea, Toggle, UiSelectExtended } from './inputs';

const componentMap: Partial<Record<RenderType, React.FC>> = {
  number: NumberInput,
  text: Text,
  textarea: TextArea,
  toggle: Toggle,
  'ui-select-extended': UiSelectExtended,
  date: DateInput,
  datetime: DateInput,
  markdown: Markdown,
  select: SelectAnswers,
  radio: SelectAnswers,
  checkbox: SelectAnswers,
};

function isQuestionTypeWithRenderOptions(value: string): value is keyof typeof renderTypeOptions {
  return value in renderTypeOptions;
}

const RenderTypeComponent: React.FC = () => {
  const { formField } = useFormField();
  // Get allowed rendering types based on formField.type
  const allowedRenderingTypes =
    formField.type && isQuestionTypeWithRenderOptions(formField.type)
      ? renderTypeOptions[formField.type]
      : renderingTypes;

  // Only get component if rendering type is allowed. Exception is program state because selecting the states is also implemented in the SelectAnswers component
  const Component =
    formField.questionOptions?.rendering &&
    allowedRenderingTypes.includes(formField.questionOptions.rendering) &&
    formField.type !== 'programState'
      ? componentMap[formField.questionOptions?.rendering]
      : null;

  if (!Component) {
    if (formField.questionOptions?.rendering) {
      console.error(
        `No component found for rendering type: ${formField.questionOptions.rendering} or a rendering type is not available for ${formField.type}`,
      );
    }
    return null;
  }

  return <Component />;
};

export default RenderTypeComponent;
