import { getImmunizationConceptAnswers } from './useImmunizationsConceptSet';

describe('getImmunizationConceptAnswers', () => {
  it('uses concept set members as selectable vaccines when answers are empty', () => {
    const answers = getImmunizationConceptAnswers(
      {
        uuid: 'f9840000-0000-4000-8000-000000000984',
        display: 'Vacuna administrada',
        answers: [],
        setMembers: [
          {
            uuid: '0e8354b6-2a33-4eca-b274-d5cf93b0c9f5',
            display: 'VACUNA ANTITUBERCULOSA (BCG)',
          },
          {
            uuid: '8ed31d60-2412-49bd-941b-c719d0cc8a71',
            display: 'VACUNA CONTRA EL ROTAVIRUS PLV (SUSPENSION ORAL)',
          },
        ],
      },
      [],
    );

    expect(answers).toEqual([
      {
        uuid: '0e8354b6-2a33-4eca-b274-d5cf93b0c9f5',
        display: 'VACUNA ANTITUBERCULOSA (BCG)',
      },
      {
        uuid: '8ed31d60-2412-49bd-941b-c719d0cc8a71',
        display: 'VACUNA CONTRA EL ROTAVIRUS PLV (SUSPENSION ORAL)',
      },
    ]);
  });

  it('deduplicates configured answers, set members, and supplemental vaccines by UUID', () => {
    const answers = getImmunizationConceptAnswers(
      {
        uuid: 'f9840000-0000-4000-8000-000000000984',
        display: 'Vacuna administrada',
        answers: [{ uuid: 'vaccine-1', display: 'Vaccine from answers' }],
        setMembers: [
          { uuid: 'vaccine-1', display: 'Vaccine from set members' },
          { uuid: 'vaccine-2', display: 'Second vaccine' },
        ],
      },
      [
        {
          uuid: 'vaccine-2',
          display: 'Second vaccine override',
        },
        {
          uuid: 'vaccine-3',
          display: 'Supplemental vaccine',
        },
      ],
    );

    expect(answers).toEqual([
      { uuid: 'vaccine-1', display: 'Vaccine from set members' },
      { uuid: 'vaccine-2', display: 'Second vaccine override' },
      { uuid: 'vaccine-3', display: 'Supplemental vaccine' },
    ]);
  });
});
