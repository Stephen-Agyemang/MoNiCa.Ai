import React, { useRef, useEffect } from 'react';

export default function TavusPlayer({ videoTrack, audioTrack }) {
  const videoRef = useRef(null);
  const videoStreamTrack = videoTrack?.track?.mediaStreamTrack || videoTrack?.publication?.track?.mediaStreamTrack || videoTrack?.mediaStreamTrack;
  const audioStreamTrack = audioTrack?.track?.mediaStreamTrack || audioTrack?.publication?.track?.mediaStreamTrack || audioTrack?.mediaStreamTrack;

  useEffect(() => {
    if (!videoRef.current) return;
    const tracksToStream = [];
    if (videoStreamTrack) tracksToStream.push(videoStreamTrack);
    if (audioStreamTrack) tracksToStream.push(audioStreamTrack);

    if (tracksToStream.length > 0) {
      // Create a unified browser MediaStream with both A/V tracks to trigger hardware clock WebRTC sync
      videoRef.current.srcObject = new MediaStream(tracksToStream);
      videoRef.current.play().catch(err => console.warn('TavusPlayer play error:', err));
    } else {
      videoRef.current.srcObject = null;
    }
  }, [videoStreamTrack, audioStreamTrack]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        borderRadius: 'inherit'
      }}
    />
  );
}