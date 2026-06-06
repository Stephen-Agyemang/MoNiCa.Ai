import { useRef, useCallback, useState } from 'react';

export function useRecording() {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeTypeRef = useRef('video/webm');
  const startTimeRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);

  const start = useCallback((cameraTrack, micTrack) => {
    const tracks = [];
    const camMs = cameraTrack?.publication?.track?.mediaStreamTrack;
    const micMs = micTrack?.publication?.track?.mediaStreamTrack;
    if (camMs) tracks.push(camMs);
    if (micMs) tracks.push(micMs);
    if (!tracks.length) return;

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

    mimeTypeRef.current = mimeType;
    chunksRef.current = [];

    try {
      const stream = new MediaStream(tracks);
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (err) {
      console.warn('MediaRecorder failed to start:', err);
    }
  }, []);

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve({ blob: null, startTime: startTimeRef.current });
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        setIsRecording(false);
        resolve({ blob, startTime: startTimeRef.current });
      };
      recorder.stop();
    });
  }, []);

  return { start, stop, isRecording };
}
