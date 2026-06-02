import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { type Mock } from 'vitest';
import CameraComponent from './camera.component';
import CameraMediaUploaderContext from './camera-media-uploader-context.resources';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

describe('CameraComponent', () => {
  let getUserMedia: Mock<() => Promise<MediaStream>>;
  let handleTakePhoto: Mock<(fileBlob: string) => void>;
  let setError: Mock<Dispatch<SetStateAction<Error>>>;
  let stopCameraStream: Mock<() => void>;
  let mediaStream: MutableRefObject<MediaStream | undefined>;

  beforeEach(() => {
    const stream = {
      getTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream;

    getUserMedia = vi.fn<() => Promise<MediaStream>>().mockResolvedValue(stream);
    handleTakePhoto = vi.fn<(fileBlob: string) => void>();
    setError = vi.fn<Dispatch<SetStateAction<Error>>>();
    stopCameraStream = vi.fn<() => void>();
    mediaStream = { current: undefined };

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
      configurable: true,
      value: null,
      writable: true,
    });

    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,captured');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a visible capture button and captures the webcam frame', async () => {
    const user = userEvent.setup();

    render(
      <CameraMediaUploaderContext.Provider value={{ handleTakePhoto, setError }}>
        <CameraComponent mediaStream={mediaStream} stopCameraStream={stopCameraStream} />
      </CameraMediaUploaderContext.Provider>,
    );

    expect(getUserMedia).toHaveBeenCalledWith({ audio: false, video: { facingMode: 'user' } });

    const captureButton = screen.getByRole('button', { name: /take photo/i });
    await waitFor(() => expect(captureButton).toBeEnabled());

    const video = screen.getByLabelText(/webcam preview/i);
    Object.defineProperty(video, 'videoWidth', { configurable: true, value: 640 });
    Object.defineProperty(video, 'videoHeight', { configurable: true, value: 480 });

    await user.click(captureButton);

    expect(handleTakePhoto).toHaveBeenCalledWith('data:image/png;base64,captured');
  });

  it('reports camera access errors', async () => {
    const error = new Error('Permission denied');
    getUserMedia.mockRejectedValue(error);

    render(
      <CameraMediaUploaderContext.Provider value={{ handleTakePhoto, setError }}>
        <CameraComponent mediaStream={mediaStream} stopCameraStream={stopCameraStream} />
      </CameraMediaUploaderContext.Provider>,
    );

    await waitFor(() => expect(setError).toHaveBeenCalledWith(error));
    expect(screen.getByRole('button', { name: /take photo/i })).toBeDisabled();
  });
});
