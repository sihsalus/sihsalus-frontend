import { openmrsFetch } from '@openmrs/esm-framework';
import { resolvePublishedForm } from './resolve-published-form';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));
const fetch = vi.mocked(openmrsFetch);
const form = {
  uuid: '7eac30a7-7c0e-4a24-8a10-733fe5c79303',
  name: 'Synthetic form',
  version: '1.0.1',
  published: true,
  retired: false,
};
beforeEach(() => fetch.mockReset());

it('selects the exact requested version without choosing a different published schema', async () => {
  fetch.mockResolvedValue({
    data: { results: [form, { ...form, uuid: 'newer', version: '2.0' }] },
  } as never);
  await expect(resolvePublishedForm('Synthetic form', { version: '1.0.1' })).resolves.toMatchObject(form);
  expect(fetch).toHaveBeenCalledWith(expect.any(String), { cache: 'no-store' });
});
it.each([
  { ...form, uuid: 'other' },
  { ...form, version: '2.0' },
  { ...form, name: 'Another form' },
  { ...form, published: false },
  { ...form, retired: true },
  { ...form, retired: undefined },
])('rejects an incompatible configured UUID before the caller can write: %j', async (response) => {
  fetch.mockResolvedValue({ data: response } as never);
  await expect(
    resolvePublishedForm(form.uuid, {
      name: form.name,
      version: form.version,
    }),
  ).rejects.toThrow();
});
it.each([
  { results: [form, { ...form, uuid: 'duplicate' }] },
  { results: [{ ...form, name: 'Approximate Synthetic form' }] },
  { results: [form], links: [{ rel: 'next' }] },
  { results: null },
])('rejects ambiguous, approximate and incomplete results: %j', async (data) => {
  fetch.mockResolvedValue({ data } as never);
  await expect(resolvePublishedForm(form.name)).rejects.toThrow();
});
it('verifies a historical UUID and keeps that schema instead of selecting a new version', async () => {
  fetch.mockResolvedValue({ data: { ...form, version: '0.9' } } as never);
  await expect(resolvePublishedForm(form.uuid)).resolves.toMatchObject({
    uuid: form.uuid,
    version: '0.9',
  });
  expect(fetch).toHaveBeenCalledOnce();
});
