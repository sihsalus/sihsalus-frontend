import { renderExtension } from '@openmrs/esm-extensions';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComponentContext } from './ComponentContext';
import { Extension } from './Extension';

vi.mock('@openmrs/esm-extensions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openmrs/esm-extensions')>();
  return { ...actual, renderExtension: vi.fn() };
});

describe('Extension', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not start a second mount while the first mount is pending', () => {
    vi.mocked(renderExtension).mockReturnValue(new Promise<null>(() => {}));
    const context = {
      moduleName: 'host-module',
      featureName: 'host-feature',
      extension: {
        extensionId: 'test-extension',
        extensionSlotName: 'test-slot',
        extensionSlotModuleName: 'host-module',
      },
    };

    const view = render(
      <ComponentContext.Provider value={context}>
        <Extension state={{ sequence: 1 }} />
      </ComponentContext.Provider>,
    );

    expect(renderExtension).toHaveBeenCalledTimes(1);

    view.rerender(
      <ComponentContext.Provider value={context}>
        <Extension state={{ sequence: 2 }} />
      </ComponentContext.Provider>,
    );

    expect(renderExtension).toHaveBeenCalledTimes(1);
  });
});
