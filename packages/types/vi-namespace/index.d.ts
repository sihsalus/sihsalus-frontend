declare global {
  namespace vi {
    // Permissive types for test-file type casts (as vi.Mock, vi.MockedFunction, etc.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Mock = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type SpyInstance = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type MockedFunction<T extends (...args: any) => any = (...args: any) => any> = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type MockedObject<T extends object> = any;
  }
}

export {};
