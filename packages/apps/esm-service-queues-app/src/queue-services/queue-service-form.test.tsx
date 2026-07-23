import { showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { saveQueue } from './queue-service.resource';
import QueueServiceForm from './queue-service-form.workspace';

const defaultProps = {
  closeWorkspace: vi.fn(),
  closeWorkspaceWithSavedChanges: vi.fn(),
  promptBeforeClosing: vi.fn(),
  setTitle: vi.fn(),
};

const mockSaveQueue = vi.mocked(saveQueue);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseLayoutType = vi.mocked(useLayoutType);

vi.mock('./queue-service.resource', () => ({
  useServiceConcepts: () => ({
    queueConcepts: [
      { uuid: '6f017eb0-b035-4acd-b284-da45f5067502', display: 'Concept 1' },
      { uuid: '5f017eb0-b035-4acd-b284-da45f5067502', display: 'Concept 2' },
    ],
  }),
  useQueueConceptSets: () => ({
    priorityConceptSet: { uuid: '8f017eb0-b035-4acd-b284-da45f5067502', display: 'Priorities' },
    statusConceptSet: { uuid: '9f017eb0-b035-4acd-b284-da45f5067502', display: 'Statuses' },
  }),
  saveQueue: vi.fn(() => Promise.resolve({ status: 201 })),
}));

vi.mock('../create-queue-entry/hooks/useQueueLocations', () => ({
  useQueueLocations: () => ({
    queueLocations: [
      { id: '34567eb0-b035-4acd-b284-da45f5067502', name: 'Location 1' },
      { id: '12wi7eb0-b035-4acd-b284-da45f5067502', name: 'Location 2' },
    ],
  }),
}));

describe('QueueServiceForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveQueue.mockResolvedValue({ status: 201 } as Awaited<ReturnType<typeof saveQueue>>);
    mockUseLayoutType.mockReturnValue('tablet');
  });

  it('renders validation errors when form is submitted with missing fields', async () => {
    const user = userEvent.setup();
    render(<QueueServiceForm {...defaultProps} />);

    const queueNameInput = screen.getByRole('textbox', { name: /queue name/i });
    const serviceTypeSelect = screen.getByRole('combobox', {
      name: /select a service type/i,
    });
    const locationSelect = screen.getByRole('combobox', {
      name: /select a UPSS/i,
    });
    const priorityConceptSetSelect = screen.getByRole('combobox', {
      name: /priority concept set/i,
    });
    const statusConceptSetSelect = screen.getByRole('combobox', {
      name: /status concept set/i,
    });
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(cancelButton).toBeInTheDocument();
    expect(saveButton).toBeInTheDocument();
    expect(queueNameInput).toBeInTheDocument();
    expect(queueNameInput).not.toBeInvalid();
    expect(serviceTypeSelect).toBeInTheDocument();
    expect(serviceTypeSelect).not.toBeInvalid();
    expect(priorityConceptSetSelect).toHaveValue('8f017eb0-b035-4acd-b284-da45f5067502');
    expect(statusConceptSetSelect).toHaveValue('9f017eb0-b035-4acd-b284-da45f5067502');

    await user.click(saveButton);
    expect(queueNameInput).toBeInvalid();

    await user.type(queueNameInput, 'Test Queue');
    expect(queueNameInput).not.toBeInvalid();
    expect(serviceTypeSelect).toBeInvalid();

    await user.selectOptions(serviceTypeSelect, '6f017eb0-b035-4acd-b284-da45f5067502');
    await user.selectOptions(locationSelect, '34567eb0-b035-4acd-b284-da45f5067502');
    await user.click(saveButton);

    expect(serviceTypeSelect).not.toBeInvalid();
    expect(queueNameInput).not.toBeInvalid();
    expect(locationSelect).not.toBeInvalid();
  });

  it('submits the form when all required fields are filled', async () => {
    const user = userEvent.setup();
    render(<QueueServiceForm {...defaultProps} />);

    const queueNameInput = screen.getByRole('textbox', { name: /queue name/i });
    const serviceTypeSelect = screen.getByRole('combobox', {
      name: /select a service type/i,
    });
    const locationSelect = screen.getByRole('combobox', {
      name: /select a UPSS/i,
    });
    const saveButton = screen.getByRole('button', { name: /save/i });

    await user.type(queueNameInput, 'Test Queue');
    await user.selectOptions(serviceTypeSelect, '6f017eb0-b035-4acd-b284-da45f5067502');
    await user.selectOptions(locationSelect, '34567eb0-b035-4acd-b284-da45f5067502');
    await user.click(saveButton);

    expect(mockSaveQueue).toHaveBeenCalledTimes(1);
    expect(mockSaveQueue).toHaveBeenCalledWith(
      'Test Queue',
      '6f017eb0-b035-4acd-b284-da45f5067502',
      '8f017eb0-b035-4acd-b284-da45f5067502',
      '9f017eb0-b035-4acd-b284-da45f5067502',
      '',
      '34567eb0-b035-4acd-b284-da45f5067502',
    );
    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      kind: 'success',
      title: expect.stringMatching(/queue service created/i),
      subtitle: expect.stringMatching(/queue service created successfully/i),
    });
  });

  it('renders a safe error message when the queue service creation fails', async () => {
    const user = userEvent.setup();
    mockSaveQueue.mockRejectedValueOnce(new Error('Internal server error'));
    render(<QueueServiceForm {...defaultProps} />);

    const queueNameInput = screen.getByRole('textbox', { name: /queue name/i });
    const serviceTypeSelect = screen.getByRole('combobox', {
      name: /select a service type/i,
    });
    const locationSelect = screen.getByRole('combobox', {
      name: /select a UPSS/i,
    });
    const saveButton = screen.getByRole('button', { name: /save/i });

    await user.type(queueNameInput, 'Test Queue');
    await user.selectOptions(serviceTypeSelect, '6f017eb0-b035-4acd-b284-da45f5067502');
    await user.selectOptions(locationSelect, '34567eb0-b035-4acd-b284-da45f5067502');
    await user.click(saveButton);

    await waitFor(() => expect(mockShowSnackbar).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith({
        isLowContrast: false,
        kind: 'error',
        title: expect.stringMatching(/error creating queue service/i),
        subtitle: expect.stringMatching(/queue operation could not be completed/i),
      }),
    );
    expect(mockShowSnackbar).not.toHaveBeenCalledWith(
      expect.objectContaining({ subtitle: expect.stringMatching(/internal server error/i) }),
    );
  });
});
