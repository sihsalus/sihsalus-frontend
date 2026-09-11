import { launchWorkspace, showSnackbar } from '@openmrs/esm-framework';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import * as imagingApi from '../../api/api';
import LinkStudiesWorkspace from './link-studies.workspace';

type NameOnlyProps = { name: string };
type ChildrenOnlyProps = { children: React.ReactNode };

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  __esModule: true,
  launchWorkspace: vi.fn(),
  showSnackbar: vi.fn(),
  createErrorHandler: vi.fn(),
  useLayoutType: vi.fn(() => 'desktop'),
  ExtensionSlot: ({ name }: NameOnlyProps) => <div data-testid={`extension-slot-${name}`} />,
  ResponsiveWrapper: ({ children }: ChildrenOnlyProps) => <div data-testid="responsive-wrapper">{children}</div>,
}));

describe('LinkStudiesWorkspace', () => {
  const patientUuid = 'patient-123';
  const mockParam = vi.fn();
  const mockUseOrthancConfigurations = vi.spyOn(imagingApi, 'useOrthancConfigurations');
  const mockGetLinkStudies = vi.spyOn(imagingApi, 'getLinkStudies');

  const orthancConfigMock = [{ id: 1, orthancBaseUrl: 'http://orthanc.local' }];

  const setup = () => {
    return render(
      <LinkStudiesWorkspace
        patientUuid={patientUuid}
        closeWorkspace={mockParam}
        promptBeforeClosing={vi.fn()}
        closeWorkspaceWithSavedChanges={vi.fn()}
        setTitle={vi.fn()}
      />,
    );
  };

  const selectOrthancServer = () => {
    const comboBox = screen.getByRole('combobox');
    fireEvent.change(comboBox, { target: { value: orthancConfigMock[0].orthancBaseUrl } });
    fireEvent.keyDown(comboBox, { key: 'ArrowDown' });
    fireEvent.keyDown(comboBox, { key: 'Enter' });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOrthancConfigurations.mockReturnValue({ data: orthancConfigMock } as ReturnType<
      typeof imagingApi.useOrthancConfigurations
    >);
  });

  beforeAll(() => {
    // Fix Carbon ComboBox + jsdom issue
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('renders from elements', () => {
    setup();

    expect(screen.getByText(/Fetch option for link studies/i)).toBeInTheDocument();
    expect(screen.getByText(/Orthanc configurations/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fetch Study/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('submits from successfully', async () => {
    const getLinkStudiesMock = mockGetLinkStudies.mockResolvedValue(undefined);
    setup();

    selectOrthancServer();
    fireEvent.click(screen.getByRole('button', { name: /Fetch Study/i }));

    await waitFor(() => {
      expect(getLinkStudiesMock).toHaveBeenCalled();
      expect(mockParam).toHaveBeenCalled();
      expect(launchWorkspace).toHaveBeenCalledWith(expect.any(String), {
        configuration: orthancConfigMock[0],
        patientUuid,
      });
    });
  });

  it('shows error snackbar when getLinkStudies fails', async () => {
    const error = new Error('Server unreachable');
    mockGetLinkStudies.mockRejectedValue(error);
    setup();

    selectOrthancServer();
    fireEvent.click(screen.getByRole('button', { name: /fetch study/i }));

    await waitFor(() => {
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle: 'The operation could not be completed. Refresh and check the result before trying again.',
        }),
      );
    });
  });

  it('closes workspace when Cancel button is clicked', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockParam).toHaveBeenCalled();
  });
  it('locks synchronization and aborts without launching a workspace after unmount', async () => {
    let resolve: () => void;
    mockGetLinkStudies.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const rendered = setup();
    selectOrthancServer();
    fireEvent.click(screen.getByRole('button', { name: /fetch study/i }));
    await waitFor(() => expect(mockGetLinkStudies).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: /fetch study/i })).toBeDisabled();
    const controller = mockGetLinkStudies.mock.calls[0][2];
    rendered.unmount();
    expect(controller.signal.aborted).toBe(true);
    await act(async () => resolve());
    expect(launchWorkspace).not.toHaveBeenCalled();
    expect(mockParam).not.toHaveBeenCalled();
  });
});

vi.mock('../utils/use-imaging-access', () => ({ useImagingAccess: vi.fn(() => ({ canWrite: true, isOnline: true })) }));
