import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {SongDetailInfo} from './domain.ts';


const loadBuffers = async (info: SongDetailInfo) => {
    const paths = [...info.bgm.map((e) => e.data), ...info.vocals.map((e) => e.data)];
    const promises = paths.map(async (path) => {
        const response = await fetch(`/data/${path}`);
        return await response.arrayBuffer();
    })
    return await Promise.all(promises);
}

const MasterVolume = 0.8;
const UpdateTimeout = 50;

export const useAudioMixer = (
    info: SongDetailInfo, singState: boolean[][], tmpState: { mute: boolean, solo: boolean }[],
    volumes: number[], pans: number[]) => {
    const [audioContext, compressor] = useMemo(() => {
        const audioContext = new window.AudioContext();
        const compressor = audioContext.createDynamicsCompressor();
        compressor.connect(audioContext.destination);
        return [audioContext, compressor];
    }, []);

    const [buffers, setBuffers] = useState<AudioBuffer[] | null>(null);
    const [sources, setSources] = useState<AudioBufferSourceNode[] | null>(null);
    const [gains, setGains] = useState<GainNode[] | null>(null);
    const [panners, setPanners] = useState<StereoPannerNode[] | null>(null);
    const [durations, setDurations] = useState<number[] | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [offsetTime, setOffsetTime] = useState<number>(0);
    const [startedAt, setStartedAt] = useState<number>(0);
    const [currentTime, setCurrentTime] = useState<number>(0);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            if (!audioContext || !compressor) return;

            const arrayBuffers = await loadBuffers(info);
            const buffers = await Promise.all(arrayBuffers.map((buffer) => audioContext.decodeAudioData(buffer)));
            const gains = buffers.map(() => audioContext.createGain());
            gains.forEach((gain, i) => gain.gain.value = i < info.bgm.length ? MasterVolume : 0);
            gains.forEach((gain) => gain.connect(compressor));
            const panners = buffers.map(() => audioContext.createStereoPanner());
            panners.forEach((panner) => panner.pan.value = 0);
            panners.forEach((panner, i) => panner.connect(gains[i]));
            const durations = buffers.map((buffer) => buffer.duration);
            setBuffers(buffers);
            setGains(gains);
            setPanners(panners);
            setDurations(durations);

            setLoading(false);
        })();
    }, [audioContext, compressor, info]);

    const play = useCallback(async (time: number | undefined = undefined) => {
        const sources = buffers!.map(() => audioContext!.createBufferSource());
        sources.forEach((source, index) => {
            source.buffer = buffers![index];
            source.connect(panners![index]);
        });
        sources[0].onended = () => {
            setIsPlaying(false);
            setOffsetTime(0);
        }
        await audioContext!.resume();
        sources.forEach((source) => source.start(0, time ?? offsetTime));
        setSources(sources);
        setStartedAt(audioContext!.currentTime);
        setIsPlaying(true);
    }, [audioContext, buffers, compressor, gains, offsetTime]);

    const stopInternal = useCallback(async (updatedOffsetTime: number | undefined = undefined) => {
        sources!.forEach((source) => source.onended = null);
        sources!.forEach((source) => source.stop());
        setIsPlaying(false);
        if (updatedOffsetTime === undefined) {
            setOffsetTime(audioContext!.currentTime - startedAt + offsetTime);
        } else {
            setOffsetTime(updatedOffsetTime);
        }
    }, [audioContext, offsetTime, sources, startedAt]);

    const pause = useCallback(async () => {
        await stopInternal();
    }, [stopInternal]);

    const seek = useCallback(async (time: number) => {
        if (isPlaying) {
            await stopInternal(time);
            await play(time);
        } else {
            setOffsetTime(time);
        }
    }, [isPlaying, play, stopInternal]);

    const stop = useCallback(async () => {
        await stopInternal(0);
    }, [stopInternal]);

    const applyGains = useCallback((time: number) => {
        if (!gains || !panners) return;

        const segmentIndex = info.segments.findIndex(({start, end}) => start <= time && time < end);
        const vocalState = segmentIndex == -1 ? [...new Array(info.vocals.length)].map(() => false) : singState[segmentIndex];
        const currentState = [...[...new Array(info.bgm.length)].map(() => true), ...vocalState];

        const existsSolo = tmpState.some((e) => e.solo);
        if (existsSolo) currentState.forEach((e, i) => currentState[i] = e && tmpState[i].solo);
        currentState.forEach((e, i) => currentState[i] = e && !tmpState[i].mute);

        const count = currentState.filter((e, i) => e && i > 0).length;
        gains.forEach((gain, i) => {
            if (i < info.bgm.length) {
                gain.gain.value = currentState[i] ? MasterVolume * volumes[i] : 0;
            } else {
                gain.gain.value = currentState[i] ? MasterVolume / Math.sqrt(count) * volumes[i] : 0;
            }
        });
        panners.forEach((panner, i) => panner.pan.value = pans[i]);
    }, [gains, panners, info.segments, info.vocals.length, info.bgm.length, singState, tmpState, volumes, pans]);

    const updateTimeoutRef = useRef<number>(0);
    const update = useCallback(() => {
        updateTimeoutRef.current = window.setTimeout(update, UpdateTimeout);

        if (!audioContext) return;
        const currentTime = isPlaying ? audioContext.currentTime - startedAt + offsetTime : offsetTime;
        setCurrentTime(currentTime);
        applyGains(currentTime + UpdateTimeout / 2000);
    }, [applyGains, audioContext, isPlaying, offsetTime, startedAt]);

    useEffect(() => {
        updateTimeoutRef.current = window.setTimeout(update, UpdateTimeout);
        return () => window.clearTimeout(updateTimeoutRef.current);
    }, [update]);

    return {loading, duration: durations ? durations[0] : 0, isPlaying, currentTime, buffers, play, pause, stop, seek};
}
