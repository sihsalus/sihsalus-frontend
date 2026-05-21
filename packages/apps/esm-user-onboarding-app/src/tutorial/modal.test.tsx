import { getDefaultsFromConfigSchema, navigate, useAppContext, useConfig } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
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

    (window as any).getOpenmrsSpaBase = vi.fn(() => '/spa-base/');
  });

  afterEach(() => {
    delete window.location;
    window.location = { pathname: '/patient-registration' } as any;
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

    Object.defineProperty(window, 'location', {
      value: { pathname: '/patient-registration' },
    });

    render(<TutorialModal onClose={onClose} />);

    const walkthroughButtons = screen.getAllByText('Walkthrough');
    await user.click(walkthroughButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.stringContaining('/spa-base/home'),
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    Object.defineProperty(window.location, 'pathname', {
      value: '/spa-base/home/service-queues',
    });

    await waitFor(() => expect(setSteps).toHaveBeenCalledWith(mockTutorialData[0].steps));
    await waitFor(() => expect(setShowTutorial).toHaveBeenCalledWith(true));
  });

  it('starts the tutorial directly without navigating when already on the home page', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    Object.defineProperty(window, 'location', {
      value: { pathname: '/spa-base/home/service-queues' },
    });

    render(<TutorialModal onClose={onClose} />);

    const walkthroughButtons = screen.getAllByText('Walkthrough');
    await user.click(walkthroughButtons[0]);

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(setSteps).toHaveBeenCalledWith(mockTutorialData[0].steps);
    expect(setShowTutorial).toHaveBeenCalledWith(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('passes the correct steps when clicking a non-first tutorial', async () => {
    const user = userEvent.setup();

    Object.defineProperty(window, 'location', {
      value: { pathname: '/spa-base/home/service-queues' },
    });

    render(<TutorialModal onClose={vi.fn()} />);

    const walkthroughButtons = screen.getAllByText('Walkthrough');
    await user.click(walkthroughButtons[1]);

    expect(setSteps).toHaveBeenCalledWith(mockTutorialData[1].steps);
  });
});
