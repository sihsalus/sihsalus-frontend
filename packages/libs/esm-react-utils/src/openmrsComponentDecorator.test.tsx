import { logError } from '@openmrs/esm-error-handling';
import { getCoreTranslation } from '@openmrs/esm-translations';
import { render, screen } from '@testing-library/react';
import React, { Component } from 'react';
import useSWR from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentContext } from './ComponentContext';
import { openmrsComponentDecorator } from './openmrsComponentDecorator';

vi.mock('@openmrs/esm-error-handling', () => ({
  logError: vi.fn(),
}));

vi.mock('@openmrs/esm-translations', () => ({
  getCoreTranslation: vi.fn(() => 'No se pudo mostrar esta información. Intente recargar la página.'),
}));

const mockGetCoreTranslation = vi.mocked(getCoreTranslation);
const mockLogError = vi.mocked(logError);

describe('openmrs-component-decorator', () => {
  const opts = {
    featureName: 'Test',
    throwErrorsToConsole: false,
    moduleName: 'test',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCoreTranslation.mockReturnValue('No se pudo mostrar esta información. Intente recargar la página.');
  });

  it('renders a component', async () => {
    const DecoratedComp = openmrsComponentDecorator(opts)(CompThatWorks);
    render(<DecoratedComp />);

    expect(await screen.findByText('The button')).toBeDefined();
  });

  it('catches any errors in the component tree and renders a ui explaining something bad happened', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const DecoratedComp = openmrsComponentDecorator(opts)(CompThatThrows);
    render(<DecoratedComp />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se pudo mostrar esta información. Intente recargar la página.',
    );
    expect(mockGetCoreTranslation).toHaveBeenCalledWith('errorLoadingInformation');
    expect(mockLogError).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('The above error occurred in the <CompThatThrows> component'),
    );
    consoleError.mockRestore();
  });

  it('logs a caught technical error without throwing it to the global handler', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const DecoratedComp = openmrsComponentDecorator({ ...opts, throwErrorsToConsole: true })(CompThatThrows);

    render(<DecoratedComp />);

    expect(mockLogError).toHaveBeenCalledOnce();
    expect(mockLogError).toHaveBeenCalledWith(expect.any(Error), 'Component error (test/Test)');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('provides ComponentContext', () => {
    const DecoratedComp = openmrsComponentDecorator(opts)(CompWithConfig);
    render(<DecoratedComp />);
  });

  it('keeps SWR available to mounted components when another decorated component unmounts', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const FirstDecoratedComp = openmrsComponentDecorator({ ...opts, featureName: 'First' })(CompWithSwr);
    const SecondDecoratedComp = openmrsComponentDecorator({ ...opts, featureName: 'Second' })(CompWithSwr);
    const { rerender } = render(
      <>
        <FirstDecoratedComp label="first" />
        <SecondDecoratedComp label="second" />
      </>,
    );

    expect(screen.getByText('second: shared-value')).toBeInTheDocument();

    rerender(<SecondDecoratedComp label="second" />);
    rerender(<SecondDecoratedComp label="second-after-unmount" />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('second-after-unmount: shared-value')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('throws a specific error when options are invalid', () => {
    expect(() => openmrsComponentDecorator({} as ComponentDecoratorOptions)).toThrow(
      'Invalid options: featureName must be a non-empty string; moduleName must be a non-empty string',
    );
    expect(() => openmrsComponentDecorator(null as unknown as ComponentDecoratorOptions)).toThrow(
      'Invalid options: expected an options object',
    );
  });

  it('rendering a unsafe component in strict mode should log error in console', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const UnsafeDecoratedCompnent = openmrsComponentDecorator(opts)(UnsafeComponent);
    render(<UnsafeDecoratedCompnent />);
    expect(consoleError.mock.calls[0][0]).toContain('Warning: Using UNSAFE_componentWillMount');
    consoleError.mockRestore();
  });

  it('rendering an unsafe component without strict mode should not log an error in console', () => {
    const spy = vi.spyOn(console, 'error');
    const unsafeComponentOptions = Object.assign(opts, { strictMode: false });
    const UnsafeDecoratedCompnent = openmrsComponentDecorator(unsafeComponentOptions)(UnsafeComponent);
    render(<UnsafeDecoratedCompnent />);
    expect(spy).not.toHaveBeenCalled();
  });
});

function CompThatWorks() {
  return <button type="button">The button</button>;
}

const CompThatThrows = function () {
  throw Error('ahahaa');
};

function CompWithConfig() {
  const { moduleName } = React.useContext(ComponentContext);
  return <div>{moduleName}</div>;
}

function CompWithSwr({ label }: { label: string }) {
  const { data } = useSWR('openmrs-component-decorator-shared-key', () => 'shared-value', {
    fallbackData: 'shared-value',
    revalidateOnMount: false,
  });

  return (
    <div>
      {label}: {data}
    </div>
  );
}

class UnsafeComponent extends Component<Record<string, never>, Record<string, never>> {
  UNSAFE_componentWillMount() {} // NOSONAR

  render() {
    return <h1>This is Unsafe Component</h1>;
  }
}
