import type { QuestionType } from '@types';
import React from 'react';
import { useFormField } from '../../form-field-context';
import {
  ObsTypeQuestion,
  PatientIdentifierTypeQuestion,
  PersonAttributeTypeQuestion,
  ProgramStateTypeQuestion,
  TestOrderTypeQuestion,
} from './inputs';

const componentMap: Partial<Record<QuestionType, React.FC>> = {
  obs: ObsTypeQuestion,
  programState: ProgramStateTypeQuestion,
  patientIdentifier: PatientIdentifierTypeQuestion,
  personAttribute: PersonAttributeTypeQuestion,
  obsGroup: ObsTypeQuestion,
  testOrder: TestOrderTypeQuestion,
};

const QuestionTypeComponent: React.FC = () => {
  const { formField } = useFormField();
  const Component = componentMap[formField.type as QuestionType];
  if (!Component) {
    console.error(`No component found for questiontype: ${formField.type}`);
    return null;
  }
  return <Component />;
};

export default QuestionTypeComponent;
