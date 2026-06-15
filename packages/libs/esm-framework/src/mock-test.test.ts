import { describe, expect, it } from 'vitest';
import * as mock from '../mock';

describe('@openmrs/esm-framework/mock', () => {
  it('should provide the framework mock APIs used by tests', () => {
    expect(mock).toEqual(
      expect.objectContaining({
        getHistory: expect.any(Function),
        goBackInHistory: expect.any(Function),
        navigate: expect.any(Function),
        openmrsFetch: expect.any(Function),
        showSnackbar: expect.any(Function),
        useConfig: expect.any(Function),
        useLayoutType: expect.any(Function),
        usePatient: expect.any(Function),
      }),
    );
  });

  it('should have a working goBackInHistory function', () => {
    mock.navigate({ to: '/test' });
    const history = mock.getHistory();
    mock.goBackInHistory({ toUrl: history[0] });
    expect(mock.getHistory()).toEqual([history[0]]);
    expect(mock.navigate).toHaveBeenCalled();
  });
});
