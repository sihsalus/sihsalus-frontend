import { launchWorkspace, showSnackbar } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import * as api from '../../api';
import LinkStudiesWorkspace from './link-studies.workspace';

type NameOnlyProps = { name: string };
type ChildrenOnlyProps = { children: React.ReactNode };

vi.mock('../../api');
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

  const orthancConfigMock = [{ id: 1, orthancBaseUrl: 'http://orthanc.local' }];

  const setup = () => {
    render(
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
    (api.useOrthancConfigurations as vi.Mock).mockReturnValue({ data: orthancConfigMock });
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
    const getLinkStudiesMock = (api.getLinkStudies as vi.Mock).mockResolvedValue({});
    setup();

    selectOrthancServer();
    fireEvent.click(screen.getByRole('button', { name: /Fetch Study/i }));

    await waitFor(() => {
      expect(getLinkStudiesMock).toHaveBeenCalled();
      expect(mockParam).toHaveBeenCalled();
      expect(launchWorkspace).toHaveBeenCalledWith(expect.any(String), {
        configuration: orthancConfigMock[0],
      });
    });
  });

  it('shows error snackbar when getLinkStudies fails', async () => {
    const error = new Error('Server unreachable');
    (api.getLinkStudies as vi.Mock).mockRejectedValue(error);
    setup();

    selectOrthancServer();
    fireEvent.click(screen.getByRole('button', { name: /fetch study/i }));

    await waitFor(() => {
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle: expect.stringContaining('Server unreachable'),
        }),
      );
    });
  });

  it('closes workspace when Cancel button is clicked', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockParam).toHaveBeenCalled();
  });
});
