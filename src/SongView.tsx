import {
    faBackward,
    faForward,
    faPause,
    faPlay,
    faRotateLeft,
    faShuffle,
    faStop
} from '@fortawesome/free-solid-svg-icons';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {useCallback, useEffect, useState} from 'react';
import {LoaderFunction, useLoaderData, useNavigate} from 'react-router';


import {SongDetailInfo, SongInfo} from './domain.ts';
import SongTracks from './SongTracks.tsx';
import './SongView.sass';
import {useAudioMixer} from './useAudioMixer.ts';
import FooterView from './Footer.tsx';


type LoaderDataType = {
    id: string,
    info: SongDetailInfo,
    meta: SongInfo,
    initialState: boolean[][]
};

export const songViewLoader: LoaderFunction = async ({params}) => {
    const id = params.id;
    const list_type = params.list_type ? `list_${params.list_type}` : 'list';

    const listResponse = await fetch(`/data/${list_type}.json`);
    const list = await listResponse.json() as SongInfo[];
    const meta = list.find(song => song.id === id);

    const infoResponse = await fetch(`/data/${id}/${id}.json`);
    const info = await infoResponse.json() as SongDetailInfo;

    const initialState = info.segments.map((segment) => {
        const singers = info.vocals.map(() => false);
        segment.singers.forEach((singer) => {
            singers[singer] = true;
        });
        return singers;
    });

    return {id, info, meta, initialState};
}

const prettifyTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}


function SongView() {
    const navigate = useNavigate();

    const {info, meta, initialState} = useLoaderData() as LoaderDataType;
    const [singState, setSingState] = useState(initialState);
    const defaultTmpState =
        [...new Array(info.bgm.length + info.vocals.length)].map(() => ({mute: false, solo: false}));
    const [tmpState, setTmpState] = useState(defaultTmpState);
    const [volumes, setVolumes] = useState([...new Array(info.bgm.length + info.vocals.length)].map(() => 1));
    const [pans, setPans] = useState([...new Array(info.bgm.length + info.vocals.length)].map(() => 0));

    const {isPlaying, currentTime, duration, buffers, play, stop, pause, seek} =
        useAudioMixer(info, singState, tmpState, volumes, pans);

    const backwardCallback = useCallback(async () => {
        await seek(currentTime - 10 > 0 ? currentTime - 10 : 0);
    }, [currentTime, seek]);
    const forwardCallback = useCallback(async () => {
        await seek(currentTime + 10 < duration ? currentTime + 10 : duration);
    }, [currentTime, duration, seek]);

    const resetCallback = useCallback(() => {
        setSingState(initialState);
    }, [initialState]);

    const seekCallback = useCallback(async (time: number) => {
        await seek(time);
    }, [seek]);

    const stateToggleCallback = useCallback((singer: number, segmentId: number) => {
        const updated = [...singState];
        updated[segmentId] = [...singState[segmentId]];
        updated[segmentId][singer] = !singState[segmentId][singer];
        setSingState(updated);
    }, [singState]);
    const batchStateCallback = useCallback((singer: number, state: boolean) => {
        const updated = [...singState];
        updated.forEach((segment, i) => {
            updated[i] = [...segment];
            updated[i][singer] = state;
        });
        setSingState(updated);
    }, [singState]);
    const tmpStateToggleCallback = useCallback((singer: number, type: 'mute' | 'solo') => {
        const updated = [...tmpState];
        updated[singer] = {...updated[singer], [type]: !tmpState[singer][type]};
        setTmpState(updated);
    }, [tmpState]);
    const volumeChangeCallback = useCallback((singer: number, volume: number) => {
        const updated = [...volumes];
        updated[singer] = volume;
        setVolumes(updated);
    }, [volumes]);
    const panChangeCallback = useCallback((singer: number, pan: number) => {
        const updated = [...pans];
        updated[singer] = pan;
        setPans(updated);
    }, [pans]);

    useEffect(() => {
        const keyDownHandler = async (event: KeyboardEvent) => {
            switch (event.key) {
                case 'ArrowLeft':
                    event.preventDefault();
                    await backwardCallback();
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    await forwardCallback();
                    break;
                case ' ':
                    event.preventDefault();
                    if (isPlaying) {
                        await pause();
                    } else {
                        await play();
                    }
                    break;
            }
        };
        document.addEventListener('keydown', keyDownHandler);
        return () => {
            document.removeEventListener('keydown', keyDownHandler);
        }
    }, [backwardCallback, forwardCallback, isPlaying, pause, play]);

    return (
        <>
            <header>
                <div></div>
                <a onClick={() => {
                    stop();
                    navigate('/')
                }}>楽曲リストに戻る</a>
            </header>
            <div id="container">
                <div id="song-info">
                    <div id="cover-art">
                        <img src={`/data/${meta.coverArt}`} alt="Cover Art"/>
                    </div>
                    <div id="song-meta">
                        <p id="song-meta-title">{meta.title}</p>
                        <p id="song-meta-artist">{meta.artist}</p>
                        <p id="song-meta-comment">{info.comment}</p>
                    </div>
                </div>
                <div id="song-position">
                    <p>{prettifyTime(currentTime)}</p>
                    <p>{prettifyTime(duration)}</p>
                </div>
                <div id="song-gauge">
                    <div id="song-gauge-total"/>
                    <div id="song-gauge-current" style={{width: `${currentTime / duration * 100}%`}}/>
                </div>
                <div id="song-nav-buttons">
                    <button onClick={backwardCallback} title="Move backward">
                        <FontAwesomeIcon icon={faBackward}/>
                    </button>
                    <button onClick={() => isPlaying ? pause() : play()} title="Play">
                        <FontAwesomeIcon icon={isPlaying ? faPause : faPlay}/>
                    </button>
                    <button onClick={stop} title="Stop">
                        <FontAwesomeIcon icon={faStop}/>
                    </button>
                    <button onClick={forwardCallback} title="Move forward">
                        <FontAwesomeIcon icon={faForward}/>
                    </button>
                    <button onClick={resetCallback} title="Reset vocal partitions">
                        <FontAwesomeIcon icon={faRotateLeft}/>
                    </button>
                    <button>
                        <FontAwesomeIcon icon={faShuffle}/>
                    </button>
                </div>
                <SongTracks info={info} buffers={buffers} duration={duration} currentTime={currentTime}
                            singState={singState} tmpState={tmpState} volumes={volumes} pans={pans}
                            stateToggleCallback={stateToggleCallback} batchStateCallback={batchStateCallback}
                            tmpStateToggleCallback={tmpStateToggleCallback} seekCallback={seekCallback}
                            volumeChangeCallback={volumeChangeCallback} panChangeCallback={panChangeCallback}/>
            </div>
            <FooterView/>
        </>
    )
}

export default SongView
