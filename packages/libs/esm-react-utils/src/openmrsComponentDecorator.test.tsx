import { render, screen } from '@testing-library/react';
import React, { Component } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ComponentContext } from './ComponentContext';
import { openmrsComponentDecorator } from './openmrsComponentDecorator';

describe.skip('openmrs-component-decorator', () => {
  const opts = {
    featureName: 'Test',
    throwErrorsToConsole: false,
    moduleName: 'test',
  };

  it('renders a component', async () => {
    const DecoratedComp = openmrsComponentDecorator(opts)(CompThatWorks);
    render(<DecoratedComp />);

    expect(await screen.findByText('The button')).toBeDefined();
  });

  it('catches any errors in the component tree and renders a ui explaining something bad happened', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const DecoratedComp = openmrsComponentDecorator(opts)(CompThatThrows);
    render(<DecoratedComp />);
    expect(screen.getByRole('alert')).toHaveTextContent('An error has occurred. Please try reloading the page.');
    // TO-DO assert the UX for broken react app is showing
    expect(consoleError).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        message: expect.stringContaining('ahahaa'),
      }),
    );
    consoleError.mockRestore();
  });

  it('provides ComponentContext', () => {
    const DecoratedComp = openmrsComponentDecorator(opts)(CompWithConfig);
    render(<DecoratedComp />);
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

class UnsafeComponent extends Component<Record<string, never>, Record<string, never>> {
  UNSAFE_componentWillMount() {} // NOSONAR

  render() {
    return <h1>This is Unsafe Component</h1>;
  }
}
