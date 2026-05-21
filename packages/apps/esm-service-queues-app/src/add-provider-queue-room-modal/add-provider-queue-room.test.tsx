import { showSnackbar } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useQueueLocations } from '../create-queue-entry/hooks/useQueueLocations';
import useQueueServices from '../hooks/useQueueService';
import { useQueues } from '../hooks/useQueues';
import { type Queue } from '../types';

import AddProviderQueueRoom from './add-provider-queue-room.modal';
import { useProvidersQueueRoom, useQueueRooms } from './add-provider-queue-room.resource';

const mockCloseModal = vi.fn();
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseQueueLocations = vi.mocked(useQueueLocations);
const mockUseQueueRooms = vi.mocked(useQueueRooms);
const mockUseProvidersQueueRoom = vi.mocked(useProvidersQueueRoom);
const mockUseQueues = vi.mocked(useQueues);
const mockUseQueueServices = vi.mocked(useQueueServices);

vi.mock('./add-provider-queue-room.resource', () => ({
  addProviderToQueueRoom: vi.fn(),
  updateProviderToQueueRoom: vi.fn().mockResolvedValue({ status: 200 }),
  useProvidersQueueRoom: vi.fn(),
  useQueueRooms: vi.fn(),
}));

vi.mock('../hooks/useQueues', () => ({
  useQueues: vi.fn(),
}));

vi.mock('../hooks/useQueueService', () => ({
  __esModule: true,
  default: vi.fn(),
}));

vi.mock('../create-queue-entry/hooks/useQueueLocations', () => ({
  useQueueLocations: vi.fn(),
}));

const providerUuid = 'cc75ad73-c24b-499c-8db9-a7ef4fc0b36d';
const defaultProps = {
  providerUuid,
  closeModal: mockCloseModal,
};

describe('AddProviderQueueRoom', () => {
  beforeEach(() => {
    mockUseQueues.mockReturnValue({
      queues: [
        { uuid: 'e7786ac0-ab62-11ec-b909-0242ac120002', display: 'Service 1' },
        { uuid: 'e7786ac0-ab62-11ec-b909-0242ac120032', display: 'Service 2' },
      ] as Queue[],
      isLoading: false,
      isValidating: false,
      error: undefined,
      mutate: vi.fn(),
    });

    mockUseQueueLocations.mockReturnValue({
      queueLocations: [
        { id: '1GHI12', name: 'Location 1' },
        { id: '1GHI45', name: 'Location 2' },
      ],
      isLoading: false,
      error: undefined,
    });

    mockUseQueueRooms.mockReturnValue({
      rooms: [
        {
          uuid: '6b3e233d-2b44-40ca-b0c8-c5a57a8c51b6',
          display: 'Room 1',
          name: 'Room 1',
          description: 'First room',
        },
        {
          uuid: 'e7786ac0-ab62-11ec-b909-0242ac120002',
          display: 'Room 2',
          name: 'Room 2',
          description: 'Second room',
        },
      ],
      isLoading: false,
      error: undefined,
    });

    mockUseProvidersQueueRoom.mockReturnValue({
      providerRoom: [
        {
          uuid: '6b3e233d-2b44-40ca-b0c8-c5a57a8c51b6',
          provider: { uuid: 'cc75ad73-c24b-499c-8db9-a7ef4fc0b36d', display: 'Provider 1' },
          queueRoom: { uuid: 'c187d78b-5c54-49bf-a0f8-b7fb6034d36d', name: 'Room 1', display: 'Room 1' },
        },
      ],
      isLoading: false,
      mutate: vi.fn(),
      error: undefined,
    });

    mockUseQueueServices.mockReturnValue({
      services: [
        { uuid: 'e7786ac0-ab62-11ec-b909-0242ac120002', display: 'Service 1' },
        { uuid: 'e7786ac0-ab62-11ec-b909-0242ac120032', display: 'Service 2' },
      ],
      isLoadingQueueServices: false,
    });
  });

  it('should render all form fields with correct labels and initial state', () => {
    renderAddProviderQueueRoom();

    expect(screen.getByRole('heading', { name: /add provider queue room/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /queue location/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /queue service/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /queue room/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /retain location/i })).toBeInTheDocument();
  });

  it('should allow selecting a queue room from the dropdown', async () => {
    const user = userEvent.setup();
    renderAddProviderQueueRoom();

    const queueRoomDropdown = screen.getByRole('combobox', { name: /queue room/i });
    await user.click(queueRoomDropdown);
    await user.click(screen.getByText('Room 1'));

    expect(screen.getByRole('option', { name: /room 1/i })).toBeInTheDocument();
  });

  it('should toggle retain location checkbox when clicked', async () => {
    const user = userEvent.setup();
    renderAddProviderQueueRoom();

    const retainLocationCheckbox = screen.getByRole('checkbox', { name: /retain location/i });
    await user.click(retainLocationCheckbox);
    expect(retainLocationCheckbox).toBeChecked();
  });

  it('should successfully submit form and show success message when all fields are filled', async () => {
    const user = userEvent.setup();
    renderAddProviderQueueRoom();

    const submitButton = screen.getByRole('button', { name: /save/i });
    const queueLocationDropdown = screen.getByRole('combobox', { name: /queue location/i });
    const queueRoomDropdown = screen.getByRole('combobox', { name: /queue room/i });
    const queueServiceDropdown = screen.getByRole('combobox', { name: /queue service/i });

    await user.click(queueRoomDropdown);
    await user.click(screen.getByText('Room 1'));
    await user.click(queueServiceDropdown);
    await user.click(screen.getByText('Service 1'));
    await user.click(queueLocationDropdown);
    await user.click(screen.getByText('Location 1'));
    await user.click(submitButton);

    expect(mockCloseModal).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: true,
      kind: 'success',
      subtitle: 'Queue room updated successfully',
      title: 'Queue room updated',
    });
  });
});

function renderAddProviderQueueRoom(props = {}) {
  render(<AddProviderQueueRoom {...defaultProps} {...props} />);
}
