import { type FormSchema } from '../types';

import { DefaultFormSchemaTransformer } from './default-schema-transformer';

function createForm(): FormSchema {
  return {
    name: 'Test form',
    pages: [
      {
        label: 'Page',
        sections: [
          {
            label: 'Section',
            questions: [
              {
                id: 'clinicalDate',
                label: 'Clinical date',
                type: 'encounterDatetime',
                questionOptions: { rendering: 'datetime' },
                validators: [],
              },
            ],
          },
        ],
      },
    ],
  } as FormSchema;
}

function createTimeForm(rendering: 'datatime' | 'time'): FormSchema {
  const form = createForm();
  const question = form.pages[0].sections[0].questions[0];
  question.type = 'obs';
  question.questionOptions.rendering = rendering as never;
  return form;
}

describe('DefaultFormSchemaTransformer', () => {
  it('prefills an encounter datetime without depending on the form-specific question id', () => {
    const consultationDatetime = new Date('2026-07-09T10:30:00.000Z');
    const form = DefaultFormSchemaTransformer.transform(createForm(), {
      encounterDatetime: consultationDatetime,
    });

    expect(form.pages[0].sections[0].questions[0].questionOptions.defaultValue).toEqual(consultationDatetime);
  });

  it.each(['time', 'datatime'] as const)('normalizes the %s rendering to a time-only control', (rendering) => {
    const form = DefaultFormSchemaTransformer.transform(createTimeForm(rendering));
    const question = form.pages[0].sections[0].questions[0];

    expect(question.questionOptions.rendering).toBe('datetime');
    expect(question.datePickerFormat).toBe('timer');
  });
});
