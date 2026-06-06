import { useState, useRef, useCallback } from 'react';

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'literally', 'actually', 'right', 'okay'];

export function useTranscription() {
  const [entries, setEntries] = useState([]);
  const entriesRef = useRef([]);
  const recognitionRef = useRef(null);
  const isActiveRef = useRef(false);
  const wordCountRef = useRef(0);
  const startTimeRef = useRef(null);
  const fillerCountRef = useRef({});

  const pushEntry = useCallback((entry) => {
    entriesRef.current = [...entriesRef.current, entry];
    setEntries([...entriesRef.current]);
  }, []);

  const updateLastInterim = useCallback((text) => {
    const arr = [...entriesRef.current];
    const lastIdx = arr.map((e, i) => ({ e, i }))
      .reverse()
      .find(({ e }) => e.speaker === 'candidate' && !e.isFinal)?.i;
    if (lastIdx !== undefined) {
      arr[lastIdx] = { ...arr[lastIdx], text };
      entriesRef.current = arr;
      setEntries([...arr]);
    } else {
      pushEntry({ speaker: 'candidate', text, timestamp: Date.now(), isFinal: false });
    }
  }, [pushEntry]);

  const finalizeLastInterim = useCallback((text) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    wordCountRef.current += words.length;

    const lower = text.toLowerCase();
    FILLER_WORDS.forEach(filler => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const count = (lower.match(regex) || []).length;
      if (count > 0) {
        fillerCountRef.current[filler] = (fillerCountRef.current[filler] || 0) + count;
      }
    });

    const arr = [...entriesRef.current];
    const lastIdx = arr.map((e, i) => ({ e, i }))
      .reverse()
      .find(({ e }) => e.speaker === 'candidate' && !e.isFinal)?.i;
    if (lastIdx !== undefined) {
      arr[lastIdx] = { ...arr[lastIdx], text, isFinal: true };
      entriesRef.current = arr;
      setEntries([...arr]);
    } else {
      pushEntry({ speaker: 'candidate', text, timestamp: Date.now(), isFinal: true });
    }
  }, [pushEntry]);

  const addMonicaEntry = useCallback((text) => {
    if (!text?.trim()) return;
    pushEntry({ speaker: 'monica', text: text.trim(), timestamp: Date.now(), isFinal: true });
  }, [pushEntry]);

  const isSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const start = useCallback(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    isActiveRef.current = true;
    startTimeRef.current = Date.now();

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const last = results[results.length - 1];
      const text = last[0].transcript;
      if (last.isFinal) {
        finalizeLastInterim(text);
      } else {
        updateLastInterim(text);
      }
    };

    recognition.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'audio-capture') return;
      console.warn('Speech recognition error:', e.error);
    };

    recognition.onend = () => {
      if (isActiveRef.current) {
        try { recognition.start(); } catch (_) { /* already started */ }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Speech recognition failed to start:', err);
    }
  }, [finalizeLastInterim, updateLastInterim]);

  const stop = useCallback(() => {
    isActiveRef.current = false;
    try { recognitionRef.current?.stop(); } catch (_) { /* ignore */ }

    const durationMin = startTimeRef.current
      ? (Date.now() - startTimeRef.current) / 60000
      : 1;
    const wpm = Math.round(wordCountRef.current / Math.max(durationMin, 0.1));
    const totalFillers = Object.values(fillerCountRef.current).reduce((a, b) => a + b, 0);

    return {
      transcript: entriesRef.current,
      wpm,
      fillerWords: { ...fillerCountRef.current },
      totalFillers,
    };
  }, []);

  // Derived live WPM (for display during session)
  const getLiveWpm = useCallback(() => {
    if (!startTimeRef.current) return 0;
    const durationMin = (Date.now() - startTimeRef.current) / 60000;
    return Math.round(wordCountRef.current / Math.max(durationMin, 0.1));
  }, []);

  const getLiveFillerCount = useCallback(() => {
    return Object.values(fillerCountRef.current).reduce((a, b) => a + b, 0);
  }, []);

  return {
    entries,
    start,
    stop,
    addMonicaEntry,
    getLiveWpm,
    getLiveFillerCount,
    isSupported,
  };
}
