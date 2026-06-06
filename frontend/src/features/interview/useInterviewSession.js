import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalParticipant, useRoomContext, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useEmotionTracker } from '../../useEmotionTracker';
import { useRecording } from './useRecording';
import { useTranscription } from './useTranscription';
import { saveSession } from '../../lib/sessionStorage';

export const CODING_KEYWORDS = [
  'software', 'developer', 'engineer', 'programmer', 'swe',
  'frontend', 'backend', 'fullstack', 'full-stack', 'devops',
  'data scientist', 'data engineer', 'ml engineer', 'machine learning',
  'web dev', 'ios', 'android', 'mobile dev',
];

export function useInterviewSession({ role }) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();

  const [question, setQuestion] = useState('');
  const [hint, setHint] = useState('');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState('');
  const [liveGrade, setLiveGrade] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [overlayTimedOut, setOverlayTimedOut] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isOverlayFadingOut, setIsOverlayFadingOut] = useState(false);

  const hasStartedRef = useRef(false);
  const roomNameRef = useRef(null);

  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.Unknown, withPlaceholder: false },
    { source: Track.Source.Microphone, withPlaceholder: false },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const localTrack = tracks.find(
    t => t.participant?.identity === localParticipant?.identity && t.source === Track.Source.Camera
  );

  const localMicTrack = tracks.find(
    t => t.participant?.identity === localParticipant?.identity && t.source === Track.Source.Microphone
  );

  const agentVideoTrack = tracks.find(
    t => !t.participant?.isLocal &&
      (
        t.participant?.identity === 'tavus-avatar-agent' ||
        t.participant?.name?.toLowerCase().includes('monica') ||
        t.participant?.identity?.includes('agent')
      ) &&
      t.publication?.kind === 'video'
  );

  const agentAudioTrack = (agentVideoTrack && tracks.find(
    t => t.participant?.identity === agentVideoTrack.participant?.identity &&
      (
        t.publication?.kind === 'audio' ||
        t.source === Track.Source.Microphone ||
        t.track?.kind === 'audio'
      )
  )) || tracks.find(
    t => !t.participant?.isLocal &&
      (
        t.publication?.kind === 'audio' ||
        t.source === Track.Source.Microphone ||
        t.track?.kind === 'audio'
      )
  );

  const { isLoaded, getEmotionSummary, videoRef, emotions } = useEmotionTracker(localTrack);
  const { start: startRecording, stop: stopRecording, isRecording } = useRecording();
  const {
    entries: transcriptEntries,
    start: startTranscription,
    stop: stopTranscription,
    addMonicaEntry,
    getLiveWpm,
    getLiveFillerCount,
    isSupported: isTranscriptionSupported,
  } = useTranscription();

  const sessionStartTimeRef = useRef(null);

  const isAgentConnected = overlayTimedOut || Boolean(agentVideoTrack || agentAudioTrack);
  const isCoding = CODING_KEYWORDS.some(k => role.toLowerCase().includes(k));

  // Keep room name in a ref for cleanup closure
  useEffect(() => {
    if (room?.name) roomNameRef.current = room.name;
  }, [room?.name]);

  // Start recording + transcription once agent is connected (session is live)
  useEffect(() => {
    if (isAgentConnected && !hasStartedRef.current && localTrack) {
      hasStartedRef.current = true;
      sessionStartTimeRef.current = Date.now();
      startRecording(localTrack, localMicTrack);
      startTranscription();
    }
  }, [isAgentConnected, localTrack, localMicTrack, startRecording, startTranscription]);

  // Smooth overlay fade-out when agent connects
  useEffect(() => {
    if (isAgentConnected) {
      setIsOverlayFadingOut(true);
      const timer = setTimeout(() => setShowOverlay(false), 1000);
      return () => clearTimeout(timer);
    } else {
      setShowOverlay(true);
      setIsOverlayFadingOut(false);
    }
  }, [isAgentConnected]);

  // Failsafe: always dismiss overlay after 15s
  useEffect(() => {
    const timer = setTimeout(() => setOverlayTimedOut(true), 15000);
    return () => clearTimeout(timer);
  }, []);

  // Periodically publish emotion summary to backend via data channel
  useEffect(() => {
    if (!room) return;
    const interval = setInterval(() => {
      const summary = getEmotionSummary();
      if (summary && summary !== 'No data') {
        try {
          const data = new TextEncoder().encode(JSON.stringify({ type: 'emotion', summary }));
          room.localParticipant.publishData(data, { reliable: true });
        } catch (e) {
          console.error('Failed to send emotion data:', e);
        }
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [room, getEmotionSummary]);

  // Data channel: receive questions, hints, grades, and typing indicators
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));

        if (data.type === 'question') {
          setQuestion(data.content);
          setHint('');
          setCode('');
          setSubmitFeedback('');
          addMonicaEntry(data.content);
        } else if (data.type === 'hint') {
          setHint(prev => prev ? prev + '\n\n' + data.content : data.content);
        } else if (data.type === 'live_grade') {
          setLiveGrade(data.score);
        } else if (data.type === 'typing' && data.status === 'start') {
          setIsTyping(true);
          setTimeout(() => setIsTyping(false), 3500);
        }
      } catch {
        // Not JSON — ignore
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => room.off('dataReceived', handleDataReceived);
  }, [room, addMonicaEntry]);

  // Save recording + transcript to IndexedDB when session ends
  useEffect(() => {
    return () => {
      if (!hasStartedRef.current) return;
      const roomName = roomNameRef.current;
      const sessionStart = sessionStartTimeRef.current;

      stopRecording().then(({ blob, startTime }) => {
        const stats = stopTranscription();
        if (!roomName) return;
        saveSession(roomName, {
          videoBlob: blob,
          transcript: stats.transcript,
          wpm: stats.wpm,
          fillerWords: stats.fillerWords,
          totalFillers: stats.totalFillers,
          sessionStartTime: startTime || sessionStart,
          role,
        });
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitCode = useCallback(async () => {
    if (!room || !code.trim()) return;
    setIsSubmitting(true);
    setSubmitFeedback('Submitted! Monica is reviewing...');
    try {
      const data = new TextEncoder().encode(JSON.stringify({
        type: 'code_submission',
        content: code,
        question,
      }));
      await room.localParticipant.publishData(data, { reliable: true });
    } catch (e) {
      console.error('Failed to send code:', e);
      setSubmitFeedback('Failed to submit. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [room, code, question]);

  return {
    // Overlay state
    showOverlay,
    isOverlayFadingOut,
    // LiveKit tracks
    localTrack,
    agentVideoTrack,
    agentAudioTrack,
    // Emotion tracker
    isLoaded,
    videoRef,
    emotions,
    // Transcript
    transcriptEntries,
    sessionStartTime: sessionStartTimeRef.current,
    isTranscriptionSupported,
    getLiveWpm,
    getLiveFillerCount,
    // Recording
    isRecording,
    // Data channel state
    question,
    hint,
    code,
    setCode,
    isSubmitting,
    submitFeedback,
    liveGrade,
    isTyping,
    // Actions
    submitCode,
    // Derived
    isCoding,
  };
}
