import { FormEngine, registerCustomDataSource } from './form-engine-lib-runtime';

describe('form-engine-lib-runtime', () => {
  it('re-exports the form engine runtime entry points as concrete values', () => {
    expect(FormEngine).toEqual(expect.any(Function));
    expect(registerCustomDataSource).toEqual(expect.any(Function));
  });
});
