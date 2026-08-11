import { isVersionSatisfied, openmrsFetch } from '@openmrs/esm-framework';

import {
  checkModules,
  clearCache,
  getBackendConnectionErrorMessage,
  getBackendConnectionErrorStatus,
  hasInvalidDependencies,
  type ResolvedBackendModuleType,
} from './openmrs-backend-dependencies';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  isVersionSatisfied: vi.fn(),
  restBaseUrl: '/ws/rest/v1',
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockIsVersionSatisfied = vi.mocked(isVersionSatisfied);

function createHttpError(status: number) {
  return Object.assign(new Error(`Server responded with ${status}`), { response: { status } });
}

describe('openmrs-backend-dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCache();
    window.installedModules = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('checkModules', () => {
    it('should return empty array when no modules have backend dependencies', async () => {
      mockOpenmrsFetch.mockResolvedValue({
        data: {
          results: [],
          links: [],
        },
      } as any);

      window.installedModules = [
        ['@openmrs/esm-app-1', {}],
        ['@openmrs/esm-app-2', {} as any],
      ];

      const result = await checkModules();

      expect(result).toEqual([]);
    });

    it('should identify missing backend modules', async () => {
      mockOpenmrsFetch.mockResolvedValue({
        data: {
          results: [{ uuid: 'webservices.rest', version: '2.24.0' }],
          links: [],
        },
      } as any);

      window.installedModules = [['@openmrs/esm-test-app', { backendDependencies: { 'missing-module': '1.0.0' } }]];

      const result = await checkModules();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('@openmrs/esm-test-app');
      expect(result[0].dependencies).toHaveLength(1);
      expect(result[0].dependencies[0]).toMatchObject({
        name: 'missing-module',
        requiredVersion: '1.0.0',
        type: 'missing',
      });
      expect(result[0].dependencies[0].installedVersion).toBeUndefined();
    });

    it('should identify version mismatches', async () => {
      mockOpenmrsFetch.mockResolvedValue({
        data: {
          results: [{ uuid: 'webservices.rest', version: '2.24.0' }],
          links: [],
        },
      } as any);

      mockIsVersionSatisfied.mockReturnValue(false);

      window.installedModules = [['@openmrs/esm-test-app', { backendDependencies: { 'webservices.rest': '^3.0.0' } }]];

      const result = await checkModules();

      expect(result[0].dependencies[0]).toMatchObject({
        name: 'webservices.rest',
        requiredVersion: '^3.0.0',
        installedVersion: '2.24.0',
        type: 'version-mismatch',
      });
    });

    it('should mark satisfied dependencies as okay', async () => {
      mockOpenmrsFetch.mockResolvedValue({
        data: {
          results: [{ uuid: 'webservices.rest', version: '2.24.0' }],
          links: [],
        },
      } as any);

      mockIsVersionSatisfied.mockReturnValue(true);

      window.installedModules = [['@openmrs/esm-test-app', { backendDependencies: { 'webservices.rest': '^2.0.0' } }]];

      const result = await checkModules();

      expect(result[0].dependencies[0]).toMatchObject({
        name: 'webservices.rest',
        requiredVersion: '^2.0.0',
        installedVersion: '2.24.0',
        type: 'okay',
      });
    });

    it('should handle multiple modules with mixed dependency states', async () => {
      mockOpenmrsFetch.mockResolvedValue({
        data: {
          results: [
            { uuid: 'webservices.rest', version: '2.24.0' },
            { uuid: 'fhir2', version: '1.5.0' },
          ],
          links: [],
        },
      } as any);

      mockIsVersionSatisfied.mockImplementation((required, installed) => {
        if (required === '^2.0.0' && installed === '2.24.0') return true;
        if (required === '^1.0.0' && installed === '1.5.0') return true;
        return false;
      });

      window.installedModules = [
        [
          '@openmrs/esm-app-1',
          {
            backendDependencies: {
              'webservices.rest': '^2.0.0',
              'missing-module': '1.0.0',
            },
          },
        ],
        ['@openmrs/esm-app-2', { backendDependencies: { fhir2: '^1.0.0' } }],
      ];

      const result = await checkModules();

      expect(result).toHaveLength(2);
      expect(result[0].dependencies).toHaveLength(2);
      expect(result[0].dependencies.find((d) => d.type === 'okay')).toBeDefined();
      expect(result[0].dependencies.find((d) => d.type === 'missing')).toBeDefined();
      expect(result[1].dependencies).toHaveLength(1);
      expect(result[1].dependencies[0].type).toBe('okay');
    });

    it('should include installed optional dependencies with required ones', async () => {
      mockOpenmrsFetch.mockResolvedValue({
        data: {
          results: [
            { uuid: 'webservices.rest', version: '2.24.0' },
            { uuid: 'fhir2', version: '1.5.0' },
          ],
          links: [],
        },
      } as any);

      mockIsVersionSatisfied.mockReturnValue(true);

      window.installedModules = [
        [
          '@openmrs/esm-test-app',
          {
            backendDependencies: { 'webservices.rest': '^2.0.0' },
            optionalBackendDependencies: {
              fhir2: '^1.0.0',
              'optional-missing': '^1.0.0',
            },
          },
        ],
      ];

      const result = await checkModules();

      expect(result[0].dependencies).toHaveLength(2);
      // Should include both required and installed optional
      expect(result[0].dependencies.find((d) => d.name === 'webservices.rest')).toBeDefined();
      expect(result[0].dependencies.find((d) => d.name === 'fhir2')).toBeDefined();
      // Should not include missing optional dependencies
      expect(result[0].dependencies.find((d) => d.name === 'optional-missing')).toBeUndefined();
    });

    it('should extract version from optional dependencies with feature flags', async () => {
      mockOpenmrsFetch.mockResolvedValue({
        data: {
          results: [
            { uuid: 'webservices.rest', version: '2.24.0' },
            { uuid: 'fhir2', version: '1.5.0' },
          ],
          links: [],
        },
      } as any);

      mockIsVersionSatisfied.mockReturnValue(true);

      window.installedModules = [
        [
          '@openmrs/esm-test-app',
          {
            backendDependencies: { 'webservices.rest': '^2.0.0' },
            optionalBackendDependencies: {
              fhir2: {
                version: '^1.0.0',
                feature: 'fhir-support' as any,
              },
            },
          },
        ],
      ];

      const result = await checkModules();

      const fhir2Dep = result[0].dependencies.find((d) => d.name === 'fhir2');
      expect(fhir2Dep).toBeDefined();
      expect(fhir2Dep?.requiredVersion).toBe('^1.0.0');
    });

    it('should cache results across multiple calls', async () => {
      mockOpenmrsFetch.mockResolvedValue({
        data: {
          results: [{ uuid: 'webservices.rest', version: '2.24.0' }],
          links: [],
        },
      } as any);

      mockIsVersionSatisfied.mockReturnValue(true);

      window.installedModules = [['@openmrs/esm-test-app', { backendDependencies: { 'webservices.rest': '^2.0.0' } }]];

      const result1 = await checkModules();
      const result2 = await checkModules();

      // Should only fetch once due to caching
      expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2); // Same reference
    });

    it('shares an in-flight inventory request between concurrent callers', async () => {
      mockOpenmrsFetch.mockResolvedValue({
        data: {
          results: [{ uuid: 'webservices.rest', version: '2.24.0' }],
          links: [],
        },
      } as unknown as Awaited<ReturnType<typeof openmrsFetch>>);
      mockIsVersionSatisfied.mockReturnValue(true);
      window.installedModules = [['@openmrs/esm-test-app', { backendDependencies: { 'webservices.rest': '^2.0.0' } }]];

      const [firstResult, secondResult] = await Promise.all([checkModules(), checkModules()]);

      expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
      expect(firstResult).toBe(secondResult);
    });

    it('does not let a superseded refresh overwrite the latest inventory', async () => {
      let resolveFirstRequest: (response: Awaited<ReturnType<typeof openmrsFetch>>) => void = () => {
        throw new Error('The first backend module request was not started');
      };
      const firstResponse = new Promise<Awaited<ReturnType<typeof openmrsFetch>>>((resolve) => {
        resolveFirstRequest = resolve;
      });
      mockOpenmrsFetch.mockReturnValueOnce(firstResponse).mockResolvedValueOnce({
        data: {
          results: [{ uuid: 'webservices.rest', version: '3.0.0' }],
          links: [],
        },
      } as unknown as Awaited<ReturnType<typeof openmrsFetch>>);
      mockIsVersionSatisfied.mockReturnValue(true);
      window.installedModules = [['@openmrs/esm-test-app', { backendDependencies: { 'webservices.rest': '^2.0.0' } }]];

      const supersededRequest = checkModules();
      const refreshedResult = await checkModules({ forceRefresh: true });
      resolveFirstRequest({
        data: {
          results: [{ uuid: 'webservices.rest', version: '1.0.0' }],
          links: [],
        },
      } as unknown as Awaited<ReturnType<typeof openmrsFetch>>);
      await supersededRequest;
      const cachedResult = await checkModules();

      expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
      expect(refreshedResult[0].dependencies[0].installedVersion).toBe('3.0.0');
      expect(cachedResult).toBe(refreshedResult);
    });

    it('should handle paginated backend module responses', async () => {
      const page1Modules = Array.from({ length: 50 }, (_, i) => ({
        uuid: `module-${i}`,
        version: '1.0.0',
      }));

      const page2Modules = [{ uuid: 'module-50', version: '1.0.0' }];

      mockOpenmrsFetch
        .mockResolvedValueOnce({
          data: {
            results: page1Modules,
            links: [{ rel: 'next', uri: '/ws/rest/v1/module?startIndex=50' }],
          },
        } as any)
        .mockResolvedValueOnce({
          data: {
            results: page2Modules,
            links: [],
          },
        } as any);

      mockIsVersionSatisfied.mockReturnValue(true);

      window.installedModules = [
        ['@openmrs/esm-test-app', { backendDependencies: { 'module-0': '1.0.0', 'module-50': '1.0.0' } }],
      ];

      const result = await checkModules();

      // Should find both modules across pages
      expect(result[0].dependencies).toHaveLength(2);
      expect(result[0].dependencies.every((d) => d.type === 'okay')).toBe(true);
    });

    it('retries a temporary 503 and resolves against the recovered inventory', async () => {
      vi.useFakeTimers();

      mockOpenmrsFetch.mockRejectedValueOnce(createHttpError(503)).mockResolvedValueOnce({
        data: {
          results: [{ uuid: 'webservices.rest', version: '2.24.0' }],
          links: [],
        },
      } as unknown as Awaited<ReturnType<typeof openmrsFetch>>);
      mockIsVersionSatisfied.mockReturnValue(true);
      window.installedModules = [['@openmrs/esm-test-app', { backendDependencies: { 'webservices.rest': '2.0.0' } }]];

      const resultPromise = checkModules();
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
      expect(mockOpenmrsFetch).toHaveBeenCalledWith(
        '/ws/rest/v1/module?v=custom:(uuid,version)',
        expect.objectContaining({ rejectOnAuthFailure: true }),
      );
      expect(result[0].dependencies[0]).toMatchObject({
        name: 'webservices.rest',
        type: 'okay',
      });
      expect(getBackendConnectionErrorMessage()).toBeNull();
    });

    it('does not cache a failed fetch as an empty inventory or report false missing modules', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockOpenmrsFetch.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({
        data: {
          results: [{ uuid: 'webservices.rest', version: '2.24.0' }],
          links: [],
        },
      } as unknown as Awaited<ReturnType<typeof openmrsFetch>>);
      mockIsVersionSatisfied.mockReturnValue(true);
      window.installedModules = [['@openmrs/esm-test-app', { backendDependencies: { 'webservices.rest': '2.0.0' } }]];

      await expect(checkModules()).rejects.toThrow('Network error');

      expect(getBackendConnectionErrorMessage()).toContain('Network error');
      expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);

      const recoveredResult = await checkModules();

      expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
      expect(recoveredResult[0].dependencies[0].type).toBe('okay');
      expect(getBackendConnectionErrorMessage()).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('bounds temporary gateway retries', async () => {
      vi.useFakeTimers();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockOpenmrsFetch.mockRejectedValue(createHttpError(503));
      window.installedModules = [['@openmrs/esm-test-app', { backendDependencies: { 'webservices.rest': '2.0.0' } }]];

      const resultPromise = checkModules();
      const rejection = expect(resultPromise).rejects.toThrow('Server responded with 503');
      await vi.runAllTimersAsync();
      await rejection;

      expect(mockOpenmrsFetch).toHaveBeenCalledTimes(3);
      expect(getBackendConnectionErrorStatus()).toBe(503);
    });

    it.each([401, 403, 500])('does not retry HTTP %s and preserves its status for feedback', async (status) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockOpenmrsFetch.mockRejectedValue(createHttpError(status));
      window.installedModules = [['@openmrs/esm-test-app', { backendDependencies: { 'webservices.rest': '2.0.0' } }]];

      await expect(checkModules()).rejects.toThrow(`Server responded with ${status}`);

      expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
      expect(getBackendConnectionErrorStatus()).toBe(status);
    });

    it('should warn when reaching pagination limit', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockOpenmrsFetch.mockResolvedValue({
        data: {
          results: [{ uuid: 'test-module', version: '1.0.0' }],
          links: [{ rel: 'next', uri: 'module?startIndex=50' }],
        },
      } as any);

      window.installedModules = [['@openmrs/esm-test-app', { backendDependencies: { 'test-module': '1.0.0' } }]];

      await checkModules();

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Reached maximum page limit'));

      consoleWarnSpy.mockRestore();
    });
  });

  describe('hasInvalidDependencies', () => {
    it('should return false when all dependencies are okay', () => {
      const modules = [
        {
          name: '@openmrs/esm-test-app',
          dependencies: [
            {
              name: 'webservices.rest',
              requiredVersion: '^2.0.0',
              installedVersion: '2.24.0',
              type: 'okay' as ResolvedBackendModuleType,
            },
          ],
        },
      ];

      expect(hasInvalidDependencies(modules)).toBe(false);
    });

    it('should return false when there are no dependencies', () => {
      const modules = [
        {
          name: '@openmrs/esm-test-app',
          dependencies: [],
        },
      ];

      expect(hasInvalidDependencies(modules)).toBe(false);
    });

    it('should return true when there are missing dependencies', () => {
      const modules = [
        {
          name: '@openmrs/esm-test-app',
          dependencies: [
            {
              name: 'missing-module',
              requiredVersion: '1.0.0',
              type: 'missing' as ResolvedBackendModuleType,
            },
          ],
        },
      ];

      expect(hasInvalidDependencies(modules)).toBe(true);
    });

    it('should return true when there are version mismatches', () => {
      const modules = [
        {
          name: '@openmrs/esm-test-app',
          dependencies: [
            {
              name: 'webservices.rest',
              requiredVersion: '^3.0.0',
              installedVersion: '2.24.0',
              type: 'version-mismatch' as ResolvedBackendModuleType,
            },
          ],
        },
      ];

      expect(hasInvalidDependencies(modules)).toBe(true);
    });

    it('should return true if any module has invalid dependencies', () => {
      const modules = [
        {
          name: '@openmrs/esm-app-1',
          dependencies: [
            {
              name: 'module-1',
              requiredVersion: '1.0.0',
              installedVersion: '1.0.0',
              type: 'okay' as ResolvedBackendModuleType,
            },
          ],
        },
        {
          name: '@openmrs/esm-app-2',
          dependencies: [
            {
              name: 'module-2',
              requiredVersion: '2.0.0',
              type: 'missing' as ResolvedBackendModuleType,
            },
          ],
        },
      ];

      expect(hasInvalidDependencies(modules)).toBe(true);
    });

    it('should return true if any dependency in any module is invalid', () => {
      const modules = [
        {
          name: '@openmrs/esm-app',
          dependencies: [
            {
              name: 'module-1',
              requiredVersion: '1.0.0',
              installedVersion: '1.0.0',
              type: 'okay' as ResolvedBackendModuleType,
            },
            {
              name: 'module-2',
              requiredVersion: '2.0.0',
              installedVersion: '1.0.0',
              type: 'version-mismatch' as ResolvedBackendModuleType,
            },
          ],
        },
      ];

      expect(hasInvalidDependencies(modules)).toBe(true);
    });
  });
});
