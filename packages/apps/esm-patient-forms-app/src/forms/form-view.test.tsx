import { getDefaultsFromConfigSchema, showModal, useConfig } from '@openmrs/esm-framework';
import {
  launchPatientWorkspace,
  launchStartVisitPrompt,
  useVisitOrOfflineVisit,
} from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { mockCurrentVisit, mockForms, mockPatient } from 'test-utils';

import { type ConfigObject, configSchema } from '../config-schema';

import FormView from './form-view.component';

void React;

const mockFhirPatient = mockPatient as unknown as fhir.Patient;
const mockLaunchPatientWorkspace = launchPatientWorkspace as vi.Mock;
const mockLaunchStartVisitPrompt = launchStartVisitPrompt as vi.Mock;
const mockShowModal = vi.mocked(showModal);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUseVisitOrOfflineVisit = useVisitOrOfflineVisit as vi.Mock;

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    launchPatientWorkspace: vi.fn(),
    launchStartVisitPrompt: vi.fn().mockImplementation(() => {
      showModal('start-visit-dialog');
    }),
    useVisitOrOfflineVisit: vi.fn(),
  };
});

mockUseConfig.mockReturnValue({
  ...getDefaultsFromConfigSchema(configSchema),
  htmlFormEntryForms: [],
});

describe('FormView', () => {
  test('should display `start-visit-dialog` when no visit has been started', async () => {
    const user = userEvent.setup();

    mockUseVisitOrOfflineVisit.mockReturnValueOnce({
      currentVisit: null,
    });

    render(
      <FormView
        patientUuid={mockPatient.uuid}
        forms={mockForms}
        pageSize={5}
        pageUrl={'/some-url'}
        patient={mockFhirPatient}
        urlLabel="some-url-label"
      />,
    );

    const pocForm = await screen.findByText('POC COVID 19 Assessment Form v1.1');
    expect(pocForm).toBeInTheDocument();

    await user.click(pocForm);

    expect(mockShowModal).toHaveBeenCalledTimes(1);
    expect(mockLaunchStartVisitPrompt).toHaveBeenCalledTimes(1);
  });

  test('should launch form-entry patient-workspace window when visit is started', async () => {
    const user = userEvent.setup();

    mockUseVisitOrOfflineVisit.mockReturnValue({
      currentVisit: mockCurrentVisit,
      error: null,
    });

    render(
      <FormView
        patientUuid={mockPatient.uuid}
        forms={mockForms}
        pageSize={5}
        pageUrl={'/some-url'}
        patient={mockFhirPatient}
        urlLabel="some-url-label"
      />,
    );

    const pocForm = await screen.findByText('POC COVID 19 Assessment Form v1.1');
    expect(pocForm).toBeInTheDocument();

    await user.click(pocForm);

    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith(
      'patient-form-entry-workspace',
      expect.objectContaining({
        workspaceTitle: mockForms[0].form.display,
        formInfo: {
          encounterUuid: undefined,
          formUuid: mockForms[0].form.uuid,
          patientUuid: mockPatient.uuid,
          visitUuid: mockCurrentVisit.uuid,
          visitTypeUuid: mockCurrentVisit.visitType.uuid,
          visitStartDatetime: mockCurrentVisit.startDatetime,
          visitStopDatetime: mockCurrentVisit.stopDatetime,
        },
      }),
    );
  });

  test('should open edit mode without requiring a current visit from the last completed column', async () => {
    const user = userEvent.setup();

    mockLaunchStartVisitPrompt.mockClear();

    mockUseVisitOrOfflineVisit.mockReturnValue({
      currentVisit: null,
      error: null,
    });

    const { container } = render(
      <FormView
        patientUuid={mockPatient.uuid}
        forms={mockForms}
        pageSize={5}
        pageUrl={'/some-url'}
        patient={mockFhirPatient}
        urlLabel="some-url-label"
      />,
    );

    const lastCompletedLink = container.querySelectorAll('tbody button')[1] as HTMLButtonElement | undefined;

    expect(lastCompletedLink).toBeInTheDocument();

    await user.click(lastCompletedLink);

    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('patient-form-entry-workspace', {
      workspaceTitle: mockForms[0].form.display,
      form: mockForms[0].form,
      encounterUuid: mockForms[0].associatedEncounters[0].uuid,
      handlePostResponse: expect.any(Function),
    });
    expect(mockLaunchStartVisitPrompt).not.toHaveBeenCalled();
  });

  test('should open edit mode without requiring a current visit from the edit button', async () => {
    const user = userEvent.setup();

    mockUseVisitOrOfflineVisit.mockReturnValue({
      currentVisit: null,
      error: null,
    });

    render(
      <FormView
        patientUuid={mockPatient.uuid}
        forms={mockForms}
        pageSize={5}
        pageUrl={'/some-url'}
        patient={mockFhirPatient}
        urlLabel="some-url-label"
      />,
    );

    const editButton = await screen.findByRole('button', { name: 'Edit form' });

    await user.click(editButton);

    expect(mockLaunchPatientWorkspace).toHaveBeenCalledWith('patient-form-entry-workspace', {
      workspaceTitle: mockForms[0].form.display,
      form: mockForms[0].form,
      encounterUuid: mockForms[0].associatedEncounters[0].uuid,
      handlePostResponse: expect.any(Function),
    });
  });
});
