import type { Form } from '../types';

export function buildNewCREDFormWorkspaceProps(
  form: Form,
  consultationDatetime: string | undefined,
  onFormSubmitted: () => void,
) {
  return {
    form,
    encounterUuid: '',
    handlePostResponse: onFormSubmitted,
    preFilledQuestions: consultationDatetime ? { encounterDatetime: new Date(consultationDatetime) } : undefined,
  };
}
