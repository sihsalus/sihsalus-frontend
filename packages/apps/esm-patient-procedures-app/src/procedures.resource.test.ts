import { restBaseUrl } from '@openmrs/esm-framework';
import { describe, expect, it } from 'vitest';
import { buildConceptSearchUrl, buildConceptSourceUrl } from './procedures.resource';

describe('procedure concept sources', () => {
  it('validates coded questions before requesting their answers', () => {
    const source = { uuid: 'procedure-status-uuid', sourceType: 'Answer to' as const };

    expect(buildConceptSourceUrl(source)).toBe(
      `${restBaseUrl}/concept/procedure-status-uuid?v=custom:(uuid)`,
    );
    expect(buildConceptSearchUrl('', source)).toContain('answerTo=procedure-status-uuid');
  });

  it('validates concept sets before requesting their members', () => {
    const source = { uuid: 'duration-units-uuid', sourceType: 'Concept set' as const };

    expect(buildConceptSourceUrl(source)).toBe(
      `${restBaseUrl}/concept/duration-units-uuid?v=custom:(uuid)`,
    );
    expect(buildConceptSearchUrl('', source)).toContain('memberOf=duration-units-uuid');
  });

  it('uses the concept class resource when validating class filters', () => {
    expect(buildConceptSourceUrl({ uuid: 'procedure-class-uuid', sourceType: 'Concept class' })).toBe(
      `${restBaseUrl}/conceptclass/procedure-class-uuid?v=custom:(uuid)`,
    );
  });

  it('does not validate unfiltered concept searches', () => {
    expect(buildConceptSourceUrl({ uuid: '', sourceType: 'any' })).toBeNull();
  });
});
