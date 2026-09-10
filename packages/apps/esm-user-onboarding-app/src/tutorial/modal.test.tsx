import { getDefaultsFromConfigSchema, navigate, useAppContext, useConfig } from '@openmrs/esm-framework';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { type Config, configSchema } from '../config-schema';
import { type TutorialContext } from '../types';
import TutorialModal from './modal.component';

const mockNavigate = vi.mocked(navigate);
const mockUseAppContext = vi.mocked(useAppContext<TutorialContext>);
const mockUseConfig = vi.mocked(useConfig<Config>);
void React;

const setShowTutorial = vi.fn();
const setSteps = vi.fn();

const mockTutorialData = [
  {
    title: 'Basic Tutorial',
    description: 'This Shows Basic Tutorials',
    steps: [
      { target: '[aria-label="OpenMRS"]', content: 'Welcome to OpenMRS' },
      { target: '[aria-label="NavBar"]', content: 'This is the Navbar' },
    ],
  },
  {
    title: 'Patient Registration Tutorial',
    description: 'This Shows how to register a patient in OpenMRS',
    steps: [
      {
        target: '[aria-label="add-btn"]',
        content: 'This is the Add Patient button',
      },
      {
        target: '[aria-label="register-form"]',
        content: 'This is the Registration form',
      },
      {
        target: '[aria-label="register-btn"]',
        content: 'This is the Register button',
      },
    ],
  },
];

describe('TutorialModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      tutorialData: mockTutorialData,
    });

    mockUseAppContext.mockReturnValue({
      showTutorial: false,
      steps: [],
      setShowTutorial,
      setSteps,
    });

    vi.stubGlobal(
      'getOpenmrsSpaBase',
      vi.fn(() => '/spa-base/'),
    );
    vi.stubGlobal('location', { pathname: '/patient-registration' });
  });

  afterEach(() => {
    if (vi.isFakeTimers()) {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
    vi.unstubAllGlobals();
  });

  it('renders tutorial titles, descriptions, and walkthrough links', () => {
    render(<TutorialModal onClose={vi.fn()} />);

    mockTutorialData.forEach((tutorial) => {
      expect(screen.getByText(tutorial.title)).toBeInTheDocument();
      expect(screen.getByText(tutorial.description)).toBeInTheDocument();
    });

    expect(screen.getAllByText('Walkthrough')).toHaveLength(mockTutorialData.length);
  });

  it('navigates to home and starts the tutorial when not already on the home page', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<TutorialModal onClose={onClose} />);

    const walkthroughButtons = screen.getAllByText('Walkthrough');
    await user.click(walkthroughButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.stringContaining('/spa-base/home'),
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    window.location.pathname = '/spa-base/home/service-queues';

    await waitFor(() => expect(setSteps).toHaveBeenCalledWith(mockTutorialData[0].steps));
    await waitFor(() => expect(setShowTutorial).toHaveBeenCalledWith(true));
  });

  it.each(['', '/', '/service-queues'])('starts directly on the home route with suffix "%s"', async (suffix) => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    vi.stubGlobal('location', { pathname: `/spa-base/home${suffix}` });

    render(<TutorialModal onClose={onClose} />);

    const walkthroughButtons = screen.getAllByText('Walkthrough');
    await user.click(walkthroughButtons[0]);

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(setSteps).toHaveBeenCalledWith(mockTutorialData[0].steps);
    expect(setShowTutorial).toHaveBeenCalledWith(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    '/spa-base/homepage',
    '/spa-base/home-other',
  ])('waits for the home route when starting at %s', (pathname) => {
    vi.useFakeTimers();
    vi.stubGlobal('location', { pathname });
    render(<TutorialModal onClose={vi.fn()} />);
    fireEvent.click(screen.getAllByText('Walkthrough')[0]);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/spa-base/home' });
    expect(setSteps).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(100));
    expect(setSteps).not.toHaveBeenCalled();

    window.location.pathname = '/spa-base/home';
    act(() => vi.advanceTimersByTime(100));
    expect(setSteps).toHaveBeenCalledWith(mockTutorialData[0].steps);
    expect(setShowTutorial).toHaveBeenCalledWith(true);
  });

  it('keeps waiting for the real home route after the modal closes', () => {
    vi.useFakeTimers();
    const { unmount } = render(<TutorialModal onClose={vi.fn()} />);
    fireEvent.click(screen.getAllByText('Walkthrough')[0]);
    unmount();

    window.location.pathname = '/spa-base/homepage';
    act(() => vi.advanceTimersByTime(100));
    expect(setSteps).not.toHaveBeenCalled();

    window.location.pathname = '/spa-base/home/service-queues';
    act(() => vi.advanceTimersByTime(100));
    expect(setSteps).toHaveBeenCalledWith(mockTutorialData[0].steps);
  });

  it('does not start an expired walkthrough if navigation arrives after the wait limit', () => {
    vi.useFakeTimers();
    render(<TutorialModal onClose={vi.fn()} />);
    fireEvent.click(screen.getAllByText('Walkthrough')[0]);
    act(() => vi.advanceTimersByTime(10000));

    window.location.pathname = '/spa-base/home';
    act(() => vi.advanceTimersByTime(100));
    expect(setSteps).not.toHaveBeenCalled();
    expect(setShowTutorial).not.toHaveBeenCalled();
  });

  it('passes the correct steps when clicking a non-first tutorial', async () => {
    const user = userEvent.setup();

    vi.stubGlobal('location', { pathname: '/spa-base/home/service-queues' });

    render(<TutorialModal onClose={vi.fn()} />);

    const walkthroughButtons = screen.getAllByText('Walkthrough');
    await user.click(walkthroughButtons[1]);

    expect(setSteps).toHaveBeenCalledWith(mockTutorialData[1].steps);
  });

  it('keeps walkthroughs disabled until the tutorial context is available', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockUseAppContext.mockReturnValue(undefined);

    const { rerender } = render(<TutorialModal onClose={onClose} />);

    const walkthrough = screen.getAllByText('Walkthrough')[0];
    expect(walkthrough).toHaveAttribute('aria-disabled', 'true');
    await user.click(walkthrough);

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(setSteps).not.toHaveBeenCalled();
    expect(setShowTutorial).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    mockUseAppContext.mockReturnValue({ showTutorial: false, steps: [], setShowTutorial, setSteps });
    window.location.pathname = '/spa-base/home';
    rerender(<TutorialModal onClose={onClose} />);

    const enabledWalkthrough = screen.getAllByText('Walkthrough')[0];
    expect(enabledWalkthrough).not.toHaveAttribute('aria-disabled', 'true');
    await user.click(enabledWalkthrough);

    expect(setSteps).toHaveBeenCalledWith(mockTutorialData[0].steps);
    expect(setShowTutorial).toHaveBeenCalledWith(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
