import type { FormSchema } from '@sihsalus/esm-form-engine-lib';

import { normalizeSchema } from './use-form-schema';

describe('normalizeSchema', () => {
  it('remaps broken legacy concept UUIDs recursively', () => {
    const schema = {
      name: 'Test schema',
      processor: 'encounter',
      uuid: 'schema-uuid',
      referencedForms: [],
      encounterType: 'encounter-type',
      pages: [
        {
          label: 'Page 1',
          sections: [
            {
              label: 'Section 1',
              isExpanded: 'true',
              questions: [
                {
                  id: 'chief-complaint',
                  type: 'obs',
                  questionOptions: {
                    rendering: 'text',
                    concept: '5219AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                  },
                },
                {
                  id: 'group',
                  type: 'obsGroup',
                  questionOptions: {
                    rendering: 'group',
                  },
                  questions: [
                    {
                      id: 'subjective',
                      type: 'obs',
                      questionOptions: {
                        rendering: 'textarea',
                        concept: '160531AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                      },
                    },
                  ],
                },
              ],
            },
          ],
          subform: {
            form: {
              name: 'Nested',
              processor: 'encounter',
              uuid: 'nested-schema-uuid',
              referencedForms: [],
              encounterType: 'encounter-type',
              pages: [
                {
                  label: 'Nested page',
                  sections: [
                    {
                      label: 'Nested section',
                      isExpanded: 'true',
                      questions: [
                        {
                          id: 'plan',
                          type: 'obs',
                          questionOptions: {
                            rendering: 'text',
                            concept: '159615AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                          },
                        },
                        {
                          id: 'lab-orders',
                          type: 'obs',
                          questionOptions: {
                            rendering: 'text',
                            concept: '1271AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                          },
                        },
                        {
                          id: 'procedures',
                          type: 'obs',
                          questionOptions: {
                            rendering: 'text',
                            concept: '1651AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                          },
                        },
                        {
                          id: 'prescriptions',
                          type: 'obs',
                          questionOptions: {
                            rendering: 'text',
                            concept: '1282AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                          },
                        },
                        {
                          id: 'referral',
                          type: 'obs',
                          questionOptions: {
                            rendering: 'text',
                            concept: '1272AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            } as FormSchema,
          },
        },
      ],
    } as FormSchema;

    const normalized = normalizeSchema(schema);

    expect(normalized.pages[0].sections[0].questions[0].questionOptions.concept).toBe(
      '71b58cff-879b-4358-98d5-2165434d4324',
    );
    expect(normalized.pages[0].sections[0].questions[1].questions?.[0].questionOptions.concept).toBe(
      '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    expect(normalized.pages[0].subform?.form.pages[0].sections[0].questions[0].questionOptions.concept).toBe(
      'c4010006-0000-4000-8000-000000000006',
    );
    expect(normalized.pages[0].subform?.form.pages[0].sections[0].questions[1].questionOptions.concept).toBe(
      '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    expect(normalized.pages[0].subform?.form.pages[0].sections[0].questions[2].questionOptions.concept).toBe(
      '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    expect(normalized.pages[0].subform?.form.pages[0].sections[0].questions[3].questionOptions.concept).toBe(
      '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    expect(normalized.pages[0].subform?.form.pages[0].sections[0].questions[4].questionOptions.concept).toBe(
      '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );

    expect(schema.pages[0].sections[0].questions[0].questionOptions.concept).toBe(
      '5219AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
    expect(schema.pages[0].sections[0].questions[1].questions?.[0].questionOptions.concept).toBe(
      '160531AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    );
  });
});
