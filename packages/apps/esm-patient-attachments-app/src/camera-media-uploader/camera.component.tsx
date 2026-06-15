import { Button } from '@carbon/react';
import { Camera as CameraIcon } from '@carbon/react/icons';
import React, { type MutableRefObject, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moduleName } from '../constants';
import styles from './camera-media-uploader.scss';
import CameraMediaUploaderContext from './camera-media-uploader-context.resources';

interface CameraComponentProps {
  mediaStream: MutableRefObject<MediaStream | undefined>;
  stopCameraStream: () => void;
}

const CameraComponent: React.FC<CameraComponentProps> = ({ mediaStream, stopCameraStream }) => {
  const { t } = useTranslation(moduleName);
  const { handleTakePhoto, setError } = useContext(CameraMediaUploaderContext);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError?.(new Error('Camera access is not supported by this browser.'));
        return;
      }

      try {
        setError?.(undefined);
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user' } });

        if (cancelled) {
          stream.getTracks().forEach((track) => {
            track.stop();
          });
          return;
        }

        mediaStream.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsCameraReady(true);
        }
      } catch (error) {
        setIsCameraReady(false);
        setError?.(error instanceof Error ? error : new Error('Camera access failed.'));
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      setIsCameraReady(false);
      stopCameraStream();
    };
  }, [mediaStream, setError, stopCameraStream]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    const width = video.videoWidth || video.clientWidth;
    const height = video.videoHeight || video.clientHeight;

    if (!width || !height) {
      setError?.(new Error('Camera preview is not ready.'));
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    if (!context) {
      setError?.(new Error('Could not capture image from camera.'));
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    handleTakePhoto?.(canvas.toDataURL('image/png'));
  }, [handleTakePhoto, setError]);

  return (
    <div className={styles.cameraPreviewContainer}>
      <video
        aria-label={t('webcamPreview', 'Webcam preview')}
        autoPlay
        className={styles.cameraVideo}
        muted
        onLoadedMetadata={() => setIsCameraReady(true)}
        playsInline
        ref={videoRef}
      />
      <canvas className={styles.cameraCanvas} ref={canvasRef} />
      <div className={styles.cameraActions}>
        <Button
          className={styles.captureButton}
          disabled={!isCameraReady}
          kind="primary"
          onClick={capturePhoto}
          renderIcon={CameraIcon}
        >
          {t('takePhoto', 'Take photo')}
        </Button>
      </div>
    </div>
  );
};

export default CameraComponent;
