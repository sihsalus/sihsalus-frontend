import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { type ExtendedStep } from '../types';
import CustomTooltip from './tooltip.component';

void React;

const defaultStep: ExtendedStep = {
  target: 'body',
  content: 'Test content',
  title: 'Test title',
};

const baseProps = {
  continuous: true,
  index: 1,
  isLastStep: false,
  size: 3,
  totalSteps: 3,
  backProps: {
    'aria-label': 'Back',
    'data-action': 'back' as const,
    onClick: vi.fn(),
    role: 'button' as const,
    title: 'Back',
  },
  closeProps: {
    'aria-label': 'Close',
    'data-action': 'close' as const,
    onClick: vi.fn(),
    role: 'button' as const,
    title: 'Close',
  },
  primaryProps: {
    'aria-label': 'Next',
    'data-action': 'primary' as const,
    onClick: vi.fn(),
    role: 'button' as const,
    title: 'Next',
  },
  skipProps: {
    'aria-label': 'Skip',
    'data-action': 'skip' as const,
    onClick: vi.fn(),
    role: 'button' as const,
    title: 'Skip',
  },
  tooltipProps: {
    'aria-modal': true as const,
    ref: vi.fn(),
    role: 'alertdialog' as const,
  },
};

function renderTooltip(step: Partial<ExtendedStep> = {}, props: Partial<typeof baseProps> = {}) {
  return render(
    <CustomTooltip
      {...baseProps}
      {...props}
      step={{ ...defaultStep, ...step }}
      totalSteps={props.totalSteps ?? baseProps.totalSteps}
    />,
  );
}

describe('CustomTooltip', () => {
  it('renders the step title and content', () => {
    renderTooltip({ title: 'My Title', content: 'My Content' });

    expect(screen.getByText('My Title')).toBeInTheDocument();
    expect(screen.getByText('My Content')).toBeInTheDocument();
  });

  it('renders the step progress', () => {
    renderTooltip({}, { index: 2, totalSteps: 5 });

    expect(screen.getByText('3 of 5')).toBeInTheDocument();
  });

  it('renders the close button by default', () => {
    renderTooltip();

    expect(screen.getByLabelText('Skip')).toBeInTheDocument();
  });

  it('hides the close button when hideCloseButton is true', () => {
    renderTooltip({ hideCloseButton: true });

    expect(screen.queryByLabelText('Skip')).not.toBeInTheDocument();
  });

  it('hides the footer when hideFooter is true', () => {
    renderTooltip({ hideFooter: true });

    expect(screen.queryByText(/of/)).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('renders the back button when index > 0', () => {
    renderTooltip({}, { index: 1 });

    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('hides the back button on the first step', () => {
    renderTooltip({}, { index: 0 });

    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('hides the back button when hideBackButton is true', () => {
    renderTooltip({ hideBackButton: true }, { index: 1 });

    expect(screen.queryByText('Back')).not.toBeInTheDocument();
  });

  it('renders the next button in continuous mode', () => {
    renderTooltip();

    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('hides the next button when hideNextButton is true', () => {
    renderTooltip({ hideNextButton: true });

    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('hides the next button when not in continuous mode', () => {
    renderTooltip({}, { continuous: false });

    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('renders "Finish" on the last step', () => {
    renderTooltip({}, { index: 2, totalSteps: 3 });

    expect(screen.getByText('Finish')).toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('calls skipProps.onClick when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderTooltip({}, { skipProps: { ...baseProps.skipProps, onClick } });

    await user.click(screen.getByLabelText('Skip'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls primaryProps.onClick when the next button is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderTooltip({}, { primaryProps: { ...baseProps.primaryProps, onClick } });

    await user.click(screen.getByText('Next'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls backProps.onClick when the back button is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderTooltip({}, { backProps: { ...baseProps.backProps, onClick } });

    await user.click(screen.getByText('Back'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
