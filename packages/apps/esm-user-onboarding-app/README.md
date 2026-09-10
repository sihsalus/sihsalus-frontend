![OpenMRS CI](https://github.com/openmrs/openmrs-esm-user-onboarding/workflows/OpenMRS%20CI/badge.svg)

New to the Project? Check out the [O3 Developer Documentation](https://openmrs.atlassian.net/wiki/x/IABBHg)

# OpenMRS ESM User Onboarding App

An interactive walkthrough system for O3 that provides guided tours and tutorials to help users learn the system. Built with React Joyride, it features multiple pre-configured tutorials covering essential workflows like patient registration, chart navigation, recording vitals and biometrics, and more.

## Features

- **Interactive Guided Tours**: Step-by-step walkthroughs using spotlight highlighting and tooltips
- **Auto-progression**: Automatically advance to next step when target elements appear
- **Multiple Tutorials**: 8 pre-configured tutorials covering core OpenMRS workflows
- **Configurable**: Customize tutorials through OpenMRS configuration system
- **Smart Waiting**: Automatically waits for elements to load before proceeding
- **Interactive Elements**: Support for clickable elements during tutorials

## Available Tutorials

1. **Basic Overview** - Introduction to main dashboard and navigation
2. **Registering a Patient** - Complete patient registration workflow
3. **Patient Chart** - Navigate and understand patient chart features
4. **Finding a Patient** - Search functionality and advanced filters
5. **Patient Lists** - Create and manage patient lists
6. **Recording Vitals** - Capture patient vitals and biometrics
7. **Starting a Patient Visit** - Begin a patient encounter
8. **Demo Tutorial** - Development and testing features

## Development

### Prerequisites

- Node.js (v22 or higher)
- Yarn package manager

### Running locally

```sh
yarn  # install dependencies
yarn start  # start development server
```

### Type checking and validation

Source and tests use the shared [strict TypeScript preset](../../tooling/tsconfig.strict.json).
Walkthrough links stay disabled until the tutorial context is available.
From the repository root, run `yarn workspace @sihsalus/esm-user-onboarding-app typescript`
and the same workspace's `lint`, `test`, and `build` scripts. Tests cover both
starting at home and navigating there, as well as an unavailable tutorial context.
The tutorial starts only on the home route or its child routes; similarly named
routes such as `/homepage` do not qualify. Navigation can finish after the modal
closes, with a ten-second limit on waiting.

## Configuration

Enable tutorials by setting `showTutorial: true` in your OpenMRS configuration. Customize tutorial content through the `tutorialData` configuration array.

## Step Configuration

### Basic Step Properties

Each tutorial step supports the following properties:

- `target`: CSS selector for the element to highlight
- `title`: Optional step title
- `content`: Step description text
- `placement`: Tooltip placement (`top`, `bottom`, `left`, `right`, `center`)
- `spotlightClicks`: Allow clicking on highlighted elements
- `disableOverlay`: Disable the dark overlay

### UI Control Properties

- `hideBackButton`: Hide the back navigation button
- `hideNextButton`: Hide the next navigation button
- `hideFooter`: Hide the entire footer
- `hideCloseButton`: Hide the close button

### Auto-transition Steps

Automatically advance when target elements appear:

```js
{
  target: '[data-extension-id="some-target"]',
  content: 'Click this button to continue',
  spotlightClicks: true,
  hideNextButton: true,
  data: {
    autoNextOn: '[data-extension-id="next-element"]'
  }
}
```

The step will automatically proceed when the `autoNextOn` selector matches an element on the page.
