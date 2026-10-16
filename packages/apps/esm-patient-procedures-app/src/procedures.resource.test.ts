import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { describe, expect, it, vi } from 'vitest';
import { buildConceptSearchUrl, buildConceptSourceUrl, deleteProcedure, updateProcedure } from './procedures.resource';

describe('procedure concept sources', () => {
  it('validates coded questions before requesting their answers', () => {
    const source = { uuid: 'procedure-status-uuid', sourceType: 'Answer to' as const };

    expect(buildConceptSourceUrl(source)).toBe(`${restBaseUrl}/concept/procedure-status-uuid?v=custom:(uuid)`);
    expect(buildConceptSearchUrl('', source)).toContain('answerTo=procedure-status-uuid');
  });

  it('validates concept sets before requesting their members', () => {
    const source = { uuid: 'duration-units-uuid', sourceType: 'Concept set' as const };

    expect(buildConceptSourceUrl(source)).toBe(`${restBaseUrl}/concept/duration-units-uuid?v=custom:(uuid)`);
    expect(buildConceptSearchUrl('', source)).toContain('memberOf=duration-units-uuid');
  });

  it('searches within a concept set using the native q parameter and preserves the complete term', () => {
    const source = { uuid: 'body-sites-set-uuid', sourceType: 'Concept set' as const };
    const query = 'Región torácica / izquierda & derecha';
    const url = new URL(buildConceptSearchUrl(query, source), 'https://example.test');

    expect(url.searchParams.get('q')).toBe(query);
    expect(url.searchParams.get('memberOf')).toBe(source.uuid);
    expect(url.searchParams.has('name')).toBe(false);
    expect(url.searchParams.has('searchType')).toBe(false);
  });

  it.each([
    ['Concept class', 'class'],
    ['Answer to', 'answerTo'],
    ['any', null],
  ] as const)('preserves the existing name/fuzzy query for %s sources', (sourceType, filter) => {
    const source = { uuid: 'source-uuid', sourceType };
    const url = new URL(buildConceptSearchUrl('tórax', source), 'https://example.test');

    expect(url.searchParams.get('name')).toBe('tórax');
    expect(url.searchParams.get('searchType')).toBe('fuzzy');
    expect(url.searchParams.has('q')).toBe(false);
    expect(url.searchParams.has('memberOf')).toBe(false);
    if (filter) {
      expect(url.searchParams.get(filter)).toBe(source.uuid);
    } else {
      expect(url.searchParams.has('class')).toBe(false);
      expect(url.searchParams.has('answerTo')).toBe(false);
    }
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

it('encodes the complete void reason as a query parameter without changing the path or text', async () => {
  const reason = 'Corrección & revisión? é😀\nMotivo = intacto';
  vi.mocked(openmrsFetch).mockResolvedValue({ status: 200 } as never);
  await deleteProcedure('procedure-uuid', reason);
  const [url, options] = vi.mocked(openmrsFetch).mock.calls[0];
  expect(new URL(url, 'https://example.test').searchParams.get('reason')).toBe(reason);
  expect(url).toContain('/procedure/procedure-uuid?');
  expect(options).toEqual({ method: 'DELETE' });
});

it('updates only submitted procedure fields, preserving patient and encounter ownership', async () => {
  vi.mocked(openmrsFetch).mockResolvedValue({ status: 200 } as never);
  await updateProcedure('procedure-uuid', { notes: 'Updated notes' });
  expect(openmrsFetch).toHaveBeenCalledWith(
    `${restBaseUrl}/procedure/procedure-uuid`,
    expect.objectContaining({ method: 'POST', body: { notes: 'Updated notes' } }),
  );
});
