import React, { useRef, useEffect, useState } from 'react';

/**
 * MonicaAvatar — Half-body interviewer portrait with natural motion.
 *
 * Now shows Monica sitting at a desk with visible hands and arms.
 * Idle: hands clasped, mouth closed.
 * Speaking: hand gesture, mouth open — crossfaded based on audio volume.
 *
 * Props:
 *   audioTrack: MediaStreamTrack (remote audio from Monica's TTS)
 */
export default function MonicaAvatar({ audioTrack }) {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [syllable, setSyllable] = useState(false);
    const [volume, setVolume] = useState(0);
    const analyserRef = useRef(null);
    const dataArrayRef = useRef(null);
    const animFrameRef = useRef(null);

    useEffect(() => {
        if (!audioTrack) {
            analyserRef.current = null;
            dataArrayRef.current = null;
            setIsSpeaking(false);
            setSyllable(false);
            setVolume(0);
            return;
        }
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const stream = new MediaStream([audioTrack]);
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.4; // lower smoothing for faster syllable reaction
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyserRef.current = analyser;
            dataArrayRef.current = dataArray;

            const checkVolume = () => {
                if (!analyserRef.current || !dataArrayRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArrayRef.current);
                const arr = dataArrayRef.current;
                // We want to detect syllables, which often have higher frequency energy (consonants)
                // rather than just the booming bass of a voice.
                let sumLow = 0;
                let sumHigh = 0;

                // Low frequencies (determines general speaking presence)
                for (let i = 2; i < 15 && i < arr.length; i++) sumLow += arr[i];
                // High frequencies (determines sharp syllable transients/mouth movements)
                for (let i = 15; i < 40 && i < arr.length; i++) sumHigh += arr[i];

                const volLow = sumLow / 13 / 255;
                const volHigh = sumHigh / 25 / 255;
                const totalVol = (volLow * 0.7) + (volHigh * 0.3);

                // isSpeaking: true if talking generally (holds the body pose)
                setIsSpeaking(totalVol > 0.03);

                // syllable: true on sharp audio peaks or high-frequency consonants (flaps the mouth open)
                // We use a lower threshold for High to make the mouth flutter more realistically on soft sounds
                setSyllable(totalVol > 0.06 || volHigh > 0.04);

                setVolume(Math.min(totalVol * 2.5, 1));
                animFrameRef.current = requestAnimationFrame(checkVolume);
            };
            animFrameRef.current = requestAnimationFrame(checkVolume);

            return () => {
                if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
                source.disconnect();
                audioCtx.close();
                analyserRef.current = null;
                dataArrayRef.current = null;
            };
        } catch (e) {
            console.warn('MonicaAvatar: Could not set up audio analysis', e);
        }
    }, [audioTrack]);

    return (
        <div
            role="img"
            aria-label="Monica, your AI interview coach"
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(160deg, #f5f0e8 0%, #ebe5da 40%, #e0d9cd 100%)',
                borderRadius: 'inherit',
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            {/* Glow behind avatar */}
            <div style={{
                position: 'absolute',
                inset: 0,
                background: isSpeaking
                    ? `radial-gradient(ellipse at center 40%, rgba(197,232,152,${0.1 + volume * 0.15}) 0%, transparent 60%)`
                    : 'none',
                transition: 'all 0.3s ease',
                pointerEvents: 'none',
            }} />

            {/*
              3-Layer VTuber Style Animation.
              No canvas shaking. Static transforms only.
            */}
            <div style={{
                position: 'relative',
                zIndex: 1,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <div style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 'inherit',
                }}>
                    {/* LAYER 1: Base Idle Image (Hands clasped, mouth closed) */}
                    <img
                        src="/monica-avatar.png"
                        alt="Monica"
                        loading="eager"
                        width="512"
                        height="512"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center top',
                            display: 'block',
                        }}
                        draggable={false}
                    />

                    {/* LAYER 2: Speaking Body (Hand raised, mouth open). 
                        Smoothly fades in when isSpeaking is true and holds position. */}
                    <img
                        src="/monica-speaking.png"
                        alt=""
                        aria-hidden="true"
                        loading="eager"
                        width="512"
                        height="512"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center top',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            opacity: isSpeaking ? 1 : 0,
                            transition: 'opacity 0.25s ease-in-out',
                        }}
                        draggable={false}
                    />

                    {/* LAYER 3: The Mouth Mask (Closes the mouth between syllables)
                        This overlay shows the closed mouth from the idle image, 
                        but ONLY in the mouth area using mask-image.
                        It cuts sharply to opacity 0 on 'syllable' peaks to reveal the open mouth below. */}
                    <img
                        src="/monica-avatar.png"
                        alt=""
                        aria-hidden="true"
                        loading="eager"
                        width="512"
                        height="512"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center top',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            opacity: (isSpeaking && syllable) ? 0 : 1,
                            transition: 'opacity 0.05s linear', // Sharp cut for lip sync
                            maskImage: 'radial-gradient(ellipse 18% 14% at 50% 36%, black 30%, transparent 100%)',
                            WebkitMaskImage: 'radial-gradient(ellipse 18% 14% at 50% 36%, black 30%, transparent 100%)',
                        }}
                        draggable={false}
                    />
                </div>
            </div>

            {/* Waveform indicator */}
            <div
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    zIndex: 2,
                    opacity: isSpeaking ? 1 : 0.3,
                    transition: 'opacity 0.3s ease',
                }}
            >
                {[0, 1, 2, 3, 4].map(i => (
                    <div
                        key={i}
                        style={{
                            width: '3px',
                            borderRadius: '2px',
                            background: isSpeaking ? '#C5E898' : '#ccc',
                            height: isSpeaking ? `${6 + volume * 14 * (1 - Math.abs(i - 2) * 0.25)}px` : '4px',
                            transition: 'height 0.1s ease, background 0.3s ease',
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
