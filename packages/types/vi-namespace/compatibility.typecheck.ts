// Compiled by test:tooling; never executed as a runtime test.
export {};

const load = vi.fn<(id: string) => Promise<number>>();
const legacyLoad: vi.MockedFunction<(id: string) => Promise<number>> = load;
legacyLoad('synthetic-id');
legacyLoad.mockResolvedValue(42);
legacyLoad.mockImplementation(async (id) => id.length);
// @ts-expect-error MockedFunction preserves the function's argument type.
legacyLoad(42);
// @ts-expect-error MockedFunction preserves the resolved result type.
legacyLoad.mockResolvedValue('invalid');
// @ts-expect-error An asynchronous function needs an asynchronous implementation.
legacyLoad.mockImplementation((id) => id.length);

const legacyMock: vi.Mock = vi.fn();
legacyMock.mockClear();
// @ts-expect-error Compatibility aliases must expose the real mock API, not any.
legacyMock.missingMockMethod();

const legacySpy: vi.SpyInstance = vi.spyOn({ load }, 'load');
legacySpy.mockRestore();
// @ts-expect-error SpyInstance preserves the official instance API.
legacySpy.missingSpyMethod();

const legacyObject: vi.MockedObject<{ load: () => Promise<number>; label: string }> = {
  load: vi.fn<() => Promise<number>>(),
  label: 'synthetic',
};
legacyObject.load.mockResolvedValue(42);
// @ts-expect-error MockedObject preserves ordinary property types.
legacyObject.label = 42;
// @ts-expect-error MockedObject preserves mocked method result types.
legacyObject.load.mockResolvedValue('invalid');

const inferredMock = vi.mocked(load);
inferredMock.mockResolvedValue(42);
// @ts-expect-error The global vi.mocked helper must preserve function types.
inferredMock.mockResolvedValue('invalid');
// @ts-expect-error Mock is a compatibility type, not a runtime property of vi.
vi.Mock;
