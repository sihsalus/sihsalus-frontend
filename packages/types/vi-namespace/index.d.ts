import type {
  Mock as VitestMock,
  MockInstance,
  MockedFunction as VitestMockedFunction,
  MockedObject as VitestMockedObject,
} from 'vitest';

declare global {
  namespace vi {
    // Compatibility for existing casts. Prefer vi.mocked or imports from Vitest in new tests.
    type Mock = VitestMock;
    type SpyInstance = MockInstance;
    type MockedFunction<T extends (...args: any[]) => any = (...args: any[]) => any> = VitestMockedFunction<T>;
    type MockedObject<T extends object> = VitestMockedObject<T>;
  }
}

export {};
