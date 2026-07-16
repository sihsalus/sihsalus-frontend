import { getNationalityConceptAnswers } from './patient-nationality.resource';

const answers = [{ uuid: 'answer-uuid', display: 'Answer' }];
const setMembers = [{ uuid: 'member-uuid', display: 'Set member' }];

describe('getNationalityConceptAnswers', () => {
  it('uses coded answers when the configured concept provides them', () => {
    expect(getNationalityConceptAnswers({ answers, setMembers })).toEqual(answers);
  });

  it('uses set members for the SIHSALUS countries concept set', () => {
    expect(getNationalityConceptAnswers({ answers: [], setMembers })).toEqual(setMembers);
  });

  it('keeps an unloaded catalog distinct from a loaded empty catalog', () => {
    expect(getNationalityConceptAnswers()).toBeUndefined();
    expect(getNationalityConceptAnswers({})).toEqual([]);
  });
});
