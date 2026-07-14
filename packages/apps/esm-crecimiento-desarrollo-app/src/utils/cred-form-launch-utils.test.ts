import type { Form } from '../types';

import { addCREDControlNumberToEncounter, buildNewCREDFormWorkspaceProps } from './cred-form-launch-utils';

describe('buildNewCREDFormWorkspaceProps', () => {
  it('always launches a new encounter while preserving the consultation date', () => {
    const onSubmitted = vi.fn();
    const form = { uuid: 'form-uuid', name: 'CRED form', display: 'CRED form' } as Form;

    const props = buildNewCREDFormWorkspaceProps(form, '2026-07-10T09:30:00-05:00', onSubmitted);

    expect(props).toEqual({
      form,
      encounterUuid: '',
      handlePostResponse: onSubmitted,
      preFilledQuestions: { encounterDatetime: new Date('2026-07-10T09:30:00-05:00') },
    });
  });

  it('adds the control number to the encounter payload atomically', () => {
    const onSubmitted = vi.fn();
    const form = { uuid: 'form-uuid', name: 'CRED form', display: 'CRED form' } as Form;
    const props = buildNewCREDFormWorkspaceProps(form, '2026-07-10T09:30:00-05:00', onSubmitted, {
      controlNumber: 3,
      controlNumberConceptUuid: 'control-number-concept',
    });

    const encounter = props.handleEncounterCreate?.({
      obs: [{ uuid: 'clinical-obs', concept: 'clinical-concept', value: 'clinical value' }],
    });

    expect(encounter).toEqual({
      obs: [
        { uuid: 'clinical-obs', concept: 'clinical-concept', value: 'clinical value' },
        { concept: 'control-number-concept', value: 3 },
      ],
    });
  });

  it('replaces an existing control-number observation instead of duplicating it', () => {
    const encounter = addCREDControlNumberToEncounter(
      {
        obs: [
          { uuid: 'control-number-obs', concept: { uuid: 'control-number-concept' }, value: 2 },
          { uuid: 'clinical-obs', concept: 'clinical-concept', value: 'clinical value' },
        ],
      },
      { controlNumber: 3, controlNumberConceptUuid: 'control-number-concept' },
    );

    expect(encounter.obs).toEqual([
      { uuid: 'control-number-obs', concept: { uuid: 'control-number-concept' }, value: 3 },
      { uuid: 'clinical-obs', concept: 'clinical-concept', value: 'clinical value' },
    ]);
  });

  it.each([0, 28, 1.5])('does not add an invalid control number (%s)', (controlNumber) => {
    const encounter = { obs: [{ uuid: 'clinical-obs', concept: 'clinical-concept', value: 'clinical value' }] };

    expect(
      addCREDControlNumberToEncounter(encounter, {
        controlNumber,
        controlNumberConceptUuid: 'control-number-concept',
      }),
    ).toBe(encounter);
  });
});
