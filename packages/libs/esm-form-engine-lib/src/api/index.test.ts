import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework/src/internal';

import type { OpenmrsForm } from '../types';
import { fetchOpenMRSForm } from './index';

vi.mock('@openmrs/esm-framework/src/internal', () => ({
  attachmentUrl: '/openmrs/ws/rest/v1/attachment',
  fhirBaseUrl: '/openmrs/ws/fhir2/R4',
  openmrsFetch: vi.fn(),
  restBaseUrl: '/openmrs/ws/rest/v1',
}));

const formUuid = '11111111-1111-4111-8111-111111111111';
const otherFormUuid = '22222222-2222-4222-8222-222222222222';

function makeForm(overrides: Partial<OpenmrsForm> = {}): OpenmrsForm {
  return {
    uuid: formUuid,
    name: 'Consulta Externa SOAP',
    encounterType: { uuid: 'encounter-type-uuid', display: 'Consulta externa' },
    version: '1.0',
    description: 'Formulario clínico',
    published: true,
    retired: false,
    resources: [],
    ...overrides,
  };
}

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('fetchOpenMRSForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null without making a request for an empty identifier', async () => {
    await expect(fetchOpenMRSForm('   ')).resolves.toBeNull();
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });

  it('returns an exact active published form requested by UUID', async () => {
    const form = makeForm();
    mockOpenmrsFetch.mockResolvedValue({ data: form } as never);

    await expect(fetchOpenMRSForm(` ${formUuid.toUpperCase()} `)).resolves.toEqual(form);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(`${restBaseUrl}/form/${formUuid.toUpperCase()}?v=full`);
  });

  it.each([
    ['a mismatched UUID', makeForm({ uuid: otherFormUuid })],
    ['an unpublished form', makeForm({ published: false })],
    ['a retired form', makeForm({ retired: true })],
    ['missing publication metadata', { ...makeForm(), published: undefined }],
    ['missing resources', { ...makeForm(), resources: undefined }],
  ])('rejects %s from a direct UUID lookup', async (_description, response) => {
    mockOpenmrsFetch.mockResolvedValue({ data: response } as never);

    await expect(fetchOpenMRSForm(formUuid)).rejects.toThrow();
  });

  it('selects the only normalized exact active match and ignores approximate or inactive matches', async () => {
    const exactActive = makeForm({ name: '  CONSULTA   EXTERNA SOÁP  ' });
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [
          makeForm({ uuid: otherFormUuid, name: 'Consulta Externa SOAP - antigua', retired: true }),
          makeForm({ uuid: '33333333-3333-4333-8333-333333333333', published: false }),
          exactActive,
        ],
      },
    } as never);

    await expect(fetchOpenMRSForm('consulta externa soa\u0301p')).resolves.toEqual(exactActive);
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      `${restBaseUrl}/form?q=consulta+externa+soa%CC%81p&v=full&limit=100`,
    );
  });

  it('follows every search page before deciding that the exact active match is unique', async () => {
    const nextUrl = `${restBaseUrl}/form?q=Consulta&v=full&limit=100&startIndex=100`;
    mockOpenmrsFetch
      .mockResolvedValueOnce({
        data: {
          results: [makeForm({ uuid: otherFormUuid, name: 'Consulta aproximada' })],
          links: [{ rel: 'next', uri: nextUrl }],
        },
      } as never)
      .mockResolvedValueOnce({ data: { results: [makeForm()] } } as never);

    await expect(fetchOpenMRSForm('Consulta Externa SOAP')).resolves.toEqual(makeForm());
    expect(mockOpenmrsFetch).toHaveBeenNthCalledWith(2, nextUrl);
  });

  it.each([
    ['no exact active match', { results: [makeForm({ name: 'Consulta parecida' })] }],
    [
      'multiple exact active matches',
      { results: [makeForm(), makeForm({ uuid: otherFormUuid, name: 'consulta externa soap' })] },
    ],
    ['a missing results array', {}],
    ['a malformed form', { results: [{ uuid: formUuid, name: 'Consulta Externa SOAP' }] }],
    ['a malformed next link', { results: [makeForm()], links: [{ rel: 'next' }] }],
  ])('rejects a name search with %s', async (_description, response) => {
    mockOpenmrsFetch.mockResolvedValue({ data: response } as never);

    await expect(fetchOpenMRSForm('Consulta Externa SOAP')).rejects.toThrow();
  });

  it('rejects cyclic pagination instead of trusting an incomplete result set', async () => {
    const firstUrl = `${restBaseUrl}/form?q=Consulta+Externa+SOAP&v=full&limit=100`;
    mockOpenmrsFetch.mockResolvedValue({
      data: { results: [], links: [{ rel: 'next', uri: firstUrl }] },
    } as never);

    await expect(fetchOpenMRSForm('Consulta Externa SOAP')).rejects.toThrow(/cyclic pagination/i);
  });
});
