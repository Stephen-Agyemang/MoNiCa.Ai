import { useState, useEffect, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';

export function useEmotionTracker(localTrack) {
    const [emotions, setEmotions] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const videoRef = useRef(null);
    const animationRef = useRef(null);

    useEffect(() => {
        const loadModels = async () => {
            try {
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
                    faceapi.nets.faceExpressionNet.loadFromUri('/models')
                ]);
                setIsLoaded(true);
            } catch (err) {
                console.error("Failed to load face-api models:", err);
            }
        };
        loadModels();
    }, []);

    useEffect(() => {
        if (!localTrack || !videoRef.current) return;
        // Handle both raw tracks and LiveKit wrapped tracks
        const mediaTrack = localTrack.mediaStreamTrack || localTrack.publication?.track?.mediaStreamTrack;
        if (mediaTrack) {
            const stream = new MediaStream([mediaTrack]);
            videoRef.current.srcObject = stream;
        }
    }, [localTrack]);

    useEffect(() => {
        if (!isLoaded || !videoRef.current) return;

        const detectEmotions = async () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
                const detections = await faceapi.detectSingleFace(
                    videoRef.current,
                    new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }) // Smallest input for speed
                ).withFaceExpressions();

                if (detections && detections.expressions) {
                    const sorted = Object.entries(detections.expressions).sort((a, b) => b[1] - a[1]);
                    const dominant = sorted[0][0];

                    setEmotions(prev => {
                        const newEmotions = [...prev, { emotion: dominant, timestamp: Date.now() }];
                        return newEmotions.slice(-1000); // Retain history of the session
                    });
                }
            }
            animationRef.current = setTimeout(detectEmotions, 200); // 5 FPS for better responsiveness
        };

        const startDetection = () => {
            if (!animationRef.current) detectEmotions();
        };

        videoRef.current.addEventListener('play', startDetection);
        if (!videoRef.current.paused) startDetection();

        return () => {
            clearTimeout(animationRef.current);
            animationRef.current = null;
            if (videoRef.current) videoRef.current.removeEventListener('play', startDetection);
        };
    }, [isLoaded]);

    const getEmotionSummary = () => {
        if (emotions.length === 0) return "No data";

        const counts = emotions.reduce((acc, curr) => {
            acc[curr.emotion] = (acc[curr.emotion] || 0) + 1;
            return acc;
        }, {});

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const total = emotions.length;
        return sorted
            .map(([emotion, count]) => `${emotion}: ${Math.round((count / total) * 100)}%`)
            .join(', ');
    };

    return { isLoaded, emotions, getEmotionSummary, videoRef };
}
