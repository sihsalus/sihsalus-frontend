import type { Form } from '../types';

import { buildNewCREDFormWorkspaceProps } from './cred-form-launch-utils';

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
});
