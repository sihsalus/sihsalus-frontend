import { openmrsFetch } from '@openmrs/esm-framework';

import { resolveMaternalForm } from './useMaternalFormLauncher';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('maternal form resolution', () => {
  beforeEach(() => {
    mockOpenmrsFetch.mockReset();
  });

  it('resolves an exact published form name and ignores a retired match', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          { uuid: 'retired-form', name: 'OBST-001-ANTECEDENTES', published: true, retired: true },
          {
            uuid: 'active-form',
            name: 'OBST-001-ANTECEDENTES',
            display: 'Antecedentes obstétricos',
            published: true,
            retired: false,
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(resolveMaternalForm('OBST-001-ANTECEDENTES', 'Antecedentes obstétricos')).resolves.toMatchObject({
      uuid: 'active-form',
      retired: false,
    });
  });

  it('rejects an approximate search result instead of opening the wrong form', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'different-form',
            name: 'OBST-001-ANTECEDENTES QUIRÚRGICOS',
            published: true,
            retired: false,
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(resolveMaternalForm('OBST-001-ANTECEDENTES', 'Antecedentes obstétricos')).rejects.toThrow(
      /No exact published maternal form/u,
    );
  });

  it('rejects ambiguous exact matches so configuration must use a stable UUID', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [
          {
            uuid: 'first-active-form',
            name: 'OBST-001-ANTECEDENTES',
            published: true,
            retired: false,
          },
          {
            uuid: 'second-active-form',
            name: 'OBST-001-ANTECEDENTES',
            published: true,
            retired: false,
          },
        ],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(resolveMaternalForm('OBST-001-ANTECEDENTES', 'Antecedentes obstétricos')).rejects.toThrow(
      /Multiple exact published maternal forms/u,
    );
  });

  it('rejects an exact match when publication metadata is missing', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        results: [{ uuid: 'unknown-state-form', name: 'OBST-001-ANTECEDENTES' }],
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(resolveMaternalForm('OBST-001-ANTECEDENTES', 'Antecedentes obstétricos')).rejects.toThrow(
      /No exact published maternal form/u,
    );
  });

  it('rejects a retired form returned from the direct UUID endpoint', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        uuid: '21f010ce-4876-32ec-8844-27dfedc6705a',
        name: 'OBST-001-ANTECEDENTES',
        published: true,
        retired: true,
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(
      resolveMaternalForm('21f010ce-4876-32ec-8844-27dfedc6705a', 'Antecedentes obstétricos'),
    ).rejects.toThrow(/unavailable, unpublished or retired/u);
  });

  it('rejects a direct UUID response that identifies a different form', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({
      data: {
        uuid: '4f9f4a48-3283-4af9-a1d1-00bb4322c899',
        name: 'OBST-001-ANTECEDENTES',
        published: true,
        retired: false,
      },
    } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(
      resolveMaternalForm('21f010ce-4876-32ec-8844-27dfedc6705a', 'Antecedentes obstétricos'),
    ).rejects.toThrow(/did not match the requested UUID/u);
  });

  it('fails closed for a malformed search payload', async () => {
    mockOpenmrsFetch.mockResolvedValueOnce({ data: {} } as Awaited<ReturnType<typeof openmrsFetch>>);

    await expect(resolveMaternalForm('OBST-001-ANTECEDENTES', 'Antecedentes obstétricos')).rejects.toThrow(
      /invalid response/u,
    );
  });
});
