import {useCallback, useEffect, useRef, useState} from 'react';

import {SongDetailInfo} from './domain.ts';


const LineHeight = 120;
const LineSpacing = 15;
const HeaderWidth = 200;
const ButtonX = [170, 130, 90, 50].map((x) => HeaderWidth - x);
const ButtonYOffset = 75;
const ButtonSize = 36;
const ButtonRadius = 5;
const SliderYOffset = [40, 60];
const SliderX = 32;
const SliderWidth = HeaderWidth - 104;

// 時刻（0〜1）から x 座標を計算する
const time2x = (time: number, canvasWidth: number, scale: number, position: number) => {
    const pos = time * scale + (1 - scale) * position;
    return (canvasWidth - HeaderWidth - 20) * pos + HeaderWidth + 20;
}

// x 座標から時刻（0〜1）を計算する
const x2time = (x: number, canvasWidth: number, scale: number, position: number) => {
    if (x < HeaderWidth + 20) return undefined;

    const pos = (x - HeaderWidth - 20) / (canvasWidth - HeaderWidth - 20);
    return (pos - (1 - scale) * position) / scale;
}

// y 座標からトラックのインデックスを計算する
const y2track = (y: number, mode: undefined | 'segmentSquare') => {
    const index = Math.floor(y / (LineHeight + LineSpacing));
    const offset = y % (LineHeight + LineSpacing);

    switch (mode) {
        case 'segmentSquare':
            return offset <= LineHeight - LineSpacing ? index : undefined;
        default:
            return index;
    }
}

const drawSeparators = (canvas: HTMLCanvasElement, count: number) => {
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;

    for (let i = 0; i < count; i++) {
        const y = i * (LineSpacing + LineHeight);

        // トラックの区切り
        ctx.beginPath();
        ctx.moveTo(0, y + LineHeight);
        ctx.lineTo(ctx.canvas.width, y + LineHeight);
        ctx.stroke();
        ctx.closePath();

        // ヘッダーとの区切り
        ctx.beginPath();
        ctx.moveTo(HeaderWidth, y);
        ctx.lineTo(HeaderWidth, y + LineHeight);
        ctx.stroke();
        ctx.closePath();
    }
}

const xy2button = (x: number, y: number) => {
    const idx = Math.floor(y / (LineHeight + LineSpacing));
    const offsetY = y % (LineHeight + LineSpacing);
    if (ButtonYOffset <= offsetY && offsetY <= ButtonYOffset + ButtonSize) {
        const buttonIndex = ButtonX.findIndex((buttonX) => buttonX <= x && x <= buttonX + ButtonSize);
        return [idx, buttonIndex == -1 ? undefined : buttonIndex];
    }
    return [undefined, undefined];
}

const xy2slider = (x: number, y: number, includeOutside: true | undefined = undefined) => {
    const idx = Math.floor(y / (LineHeight + LineSpacing));
    const offsetY = y % (LineHeight + LineSpacing);
    const typeIdx = SliderYOffset.findIndex((sliderYOffset) => sliderYOffset - 5 <= offsetY && offsetY <= sliderYOffset + 5);
    if (!includeOutside && typeIdx == -1) {
        return [undefined, undefined, undefined];
    }
    const rate = (x - SliderX) / SliderWidth;
    if (includeOutside) {
        if (rate < 0) return [idx, typeIdx, 0.0];
        if (1 < rate) return [idx, typeIdx, 1.0];
        return [idx, typeIdx, rate];
    } else if (rate >= 0 && rate <= 1) {
        return [idx, typeIdx, rate];
    }
    return [idx, undefined];
}

const drawHeaders = (
    canvas: HTMLCanvasElement, bgm: { name: string }[], vocals: { color: string, name: string }[],
    volumes: number[], pans: number[], tmpState: { mute: boolean, solo: boolean }[], mousePosition: { x: number, y: number } | undefined) => {


    let hoverTrack: number | undefined = undefined;
    let hoverButton: number | undefined = undefined;
    if (mousePosition) {
        [hoverTrack, hoverButton] = xy2button(mousePosition.x, mousePosition.y);
    }

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, HeaderWidth + 20, ctx.canvas.height);

    const bgmTmp = bgm.map((bgm) => ({...bgm, color: '#fff'}));

    [...bgmTmp, ...vocals].forEach(({color, name}, i) => {
        const y = i * (LineSpacing + LineHeight);
        const ctx = canvas.getContext('2d')!;

        // 左の色付きバー
        ctx.fillStyle = color;
        ctx.fillRect(0, y, 15, LineHeight);

        // ミュート・ソロのボタンの色
        const activeButtons = [] as { color: string, index: number }[];
        if (tmpState[i]?.mute) activeButtons.push({color: '#f30100', index: 2});
        if (tmpState[i]?.solo) activeButtons.push({color: '#5ce626', index: 3});

        ctx.globalAlpha = 0.7;
        activeButtons.forEach(({color, index}) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(ButtonX[index], y + ButtonYOffset, ButtonSize, ButtonSize, ButtonRadius);
            ctx.fill();
            ctx.closePath();
        });
        ctx.globalAlpha = 1;

        // ボタンのホバー色
        if (hoverTrack == i && hoverButton !== undefined && 0 <= hoverButton && hoverButton <= 3 && !(hoverTrack < bgm.length && hoverButton < 2)) {
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.roundRect(ButtonX[hoverButton], y + ButtonYOffset, ButtonSize, ButtonSize, ButtonRadius);
            ctx.fill();
            ctx.closePath();
            ctx.globalAlpha = 1;
        }

        // ボタンの枠
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ButtonX.forEach((x, j) => {
            if (i < bgm.length && j < 2) return;
            ctx.beginPath();
            ctx.roundRect(x, y + ButtonYOffset, 36, 36, 5);
            ctx.stroke();
            ctx.closePath();
        });

        // ボリューム・パンスライダー
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 4;
        SliderYOffset.forEach((yOffset) => {
            ctx.beginPath();
            ctx.moveTo(SliderX, y + yOffset);
            ctx.lineTo(SliderX + SliderWidth, y + yOffset);
            ctx.stroke();
            ctx.closePath();
        });

        // ボリューム・パンスライダーのハンドル
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(SliderX + SliderWidth * volumes[i] * 0.5, y + SliderYOffset[0], 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(SliderX + SliderWidth * (pans[i] + 1) * 0.5, y + SliderYOffset[1], 8, 0, Math.PI * 2);
        ctx.fill();

        // 名前
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.strokeStyle = 'none';
        ctx.font = '22px sans-serif';
        ctx.fillText(name, 25, y + 6);

        // ボタンテキスト
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (i >= bgm.length) {
            ctx.font = '12px sans-serif';
            ctx.fillText('ALL', ButtonX[0] + ButtonSize / 2, y + ButtonYOffset + ButtonSize / 2 - 7);
            ctx.fillText('ALL', ButtonX[1] + ButtonSize / 2, y + ButtonYOffset + ButtonSize / 2 - 7);
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('OFF', ButtonX[0] + ButtonSize / 2, y + ButtonYOffset + ButtonSize / 2 + 7);
            ctx.fillText('ON', ButtonX[1] + ButtonSize / 2, y + ButtonYOffset + ButtonSize / 2 + 7);
        }
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('M', ButtonX[2] + ButtonSize / 2, y + ButtonYOffset + ButtonSize / 2);
        ctx.fillText('S', ButtonX[3] + ButtonSize / 2, y + ButtonYOffset + ButtonSize / 2);

        // ボリューム
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = '20px sans-serif';
        ctx.fillText(`${Math.floor(volumes[i] * 100)}`, HeaderWidth - 10, y + SliderYOffset[0]);
        if (pans[i] <= -0.01) {
            ctx.fillText(`L${Math.floor(-pans[i] * 100)}`, HeaderWidth - 10, y + SliderYOffset[1]);
        } else if (pans[i] >= 0.01) {
            ctx.fillText(`R${Math.floor(pans[i] * 100)}`, HeaderWidth - 10, y + SliderYOffset[1]);
        } else {
            ctx.fillText('C', HeaderWidth - 10, y + SliderYOffset[1]);
        }
    });
}

const WaveformInterval = 0.5;

const drawWaveforms = (canvas: HTMLCanvasElement, buffers: AudioBuffer[], scale: number, position: number) => {
    buffers.forEach((buffer, i) => {
        const yOffset = i * (LineHeight + LineSpacing) + (LineHeight - LineSpacing) / 2.0
        const data = buffer.getChannelData(0);

        const ctx = canvas.getContext('2d')!;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;

        for (let x = HeaderWidth + 20; x < canvas.width; x += WaveformInterval) {
            let min = 0;
            let max = 0;

            const timeFrom = x2time(x, canvas.width, scale, position);
            const timeTo = x2time(x + WaveformInterval, canvas.width, scale, position);
            if (timeFrom === undefined || timeTo === undefined) continue;

            const from = Math.floor(timeFrom * data.length);
            const to = Math.floor(timeTo * data.length);
            const interval = Math.floor((to - from) / 20 + 1);
            for (let j = from; j < to; j += interval) {
                const value = data[j];
                if (min > value) min = value;
                if (max < value) max = value;
            }

            const yMin = yOffset + min * (LineHeight - LineSpacing) / 2.0;
            const yMax = yOffset + max * (LineHeight - LineSpacing) / 2.0;
            ctx.beginPath();
            ctx.moveTo(x, yMin);
            ctx.lineTo(x, yMax);
            ctx.stroke();
        }
    });
}

const drawSegments = (
    canvas: HTMLCanvasElement, vocals: { color: string }[], segments: { start: number, end: number }[],
    singState: boolean[][], bgmCount: number, scale: number, position: number, duration: number,
    mousePosition: { x: number, y: number } | undefined) => {
    const ctx = canvas.getContext('2d')!;

    const hoverTrack = mousePosition ? y2track(mousePosition.y, 'segmentSquare') : undefined;

    vocals.forEach(({color}, i) => {
        const yOffset = (i + bgmCount) * (LineHeight + LineSpacing);
        segments.forEach(({start, end}, j) => {
            const x = time2x(start / duration, canvas.width, scale, position) + 1;
            const w = time2x(end / duration, canvas.width, scale, position) - x - 1;

            const isSinging = singState[j][i];
            const c = isSinging ? color : '#444';

            ctx.fillStyle = c;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.roundRect(x, yOffset, w, LineHeight - LineSpacing, 5);
            ctx.fill();
            ctx.closePath();

            if (hoverTrack == i + bgmCount && mousePosition && x <= mousePosition.x && mousePosition.x <= x + w) {
                ctx.fillStyle = '#fff';
                ctx.globalAlpha = 0.2;
                ctx.beginPath();
                ctx.roundRect(x, yOffset, w, LineHeight - LineSpacing, 5);
                ctx.fill();
                ctx.closePath();
            }

            ctx.strokeStyle = c;
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.roundRect(x, yOffset, w, LineHeight - LineSpacing, 5);
            ctx.stroke();
            ctx.closePath();
        });
    });
}

const drawCursor = (canvas: HTMLCanvasElement, scale: number, renderPosition: number, cursorPosition: number) => {
    const ctx = canvas.getContext('2d')!;
    const x = time2x(cursorPosition, canvas.width, scale, renderPosition);

    if (x < HeaderWidth + 20) return;

    ctx.strokeStyle = '#ffc639';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
    ctx.closePath();
}

const drawMinimap = (
    canvas: HTMLCanvasElement, vocals: { color: string }[], segments: { start: number, end: number }[],
    singState: boolean[][], scale: number, position: number, duration: number, currentTime: number) => {
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    vocals.forEach(({color}, i) => {
        ctx.fillStyle = color;
        segments.forEach(({start, end}, j) => {
            if (!singState[j][i]) return;
            const x = start / duration * (canvas.width - 10) + 5;
            const width = (end - start) / duration * (canvas.width - 10);
            ctx.fillRect(x, i * 8 + 10, width, 5);
        });
    });

    const pageStartTime = (scale - 1) * position / scale;
    const pageEndTime = (1 - (1 - scale) * position) / scale;
    const pageStartX = pageStartTime * (canvas.width - 10) + 5;
    const pageEndX = pageEndTime * (canvas.width - 10) + 5;
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(pageStartX, 2, pageEndX - pageStartX, canvas.height - 4, 5);
    ctx.stroke();
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.roundRect(pageStartX, 2, pageEndX - pageStartX, canvas.height - 4, 5);
    ctx.fill();
    ctx.closePath();
    ctx.globalAlpha = 1;

    const cursorX = currentTime / duration * (canvas.width - 10) + 5;
    ctx.strokeStyle = '#ffc639';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, canvas.height);
    ctx.stroke();
    ctx.closePath();
};

function SongTracks(props: {
    info: SongDetailInfo,
    buffers: AudioBuffer[] | null,
    duration: number,
    currentTime: number,
    singState: boolean[][],
    tmpState: { mute: boolean, solo: boolean }[],
    volumes: number[],
    pans: number[],
    stateToggleCallback: (singer: number, segmentId: number) => void,
    batchStateCallback: (singer: number, state: boolean) => void,
    tmpStateToggleCallback: (singer: number, type: 'mute' | 'solo') => void,
    seekCallback: (time: number) => void,
    volumeChangeCallback: (singer: number, volume: number) => void,
    panChangeCallback: (singer: number, pan: number) => void,
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const minimapCanvasRef = useRef<HTMLCanvasElement>(null);

    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState(0);

    const [mousePosition, setMousePosition] = useState<{ x: number, y: number } | undefined>(undefined);

    const [draggingInfo, setDraggingInfo] =
        useState<{ type: 'volume', index: number } | { type: 'pan', index: number } | { type: 'position' } | { type: 'none' }>({type: 'none'});

    const draw = useCallback(() => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        if (props.buffers) drawWaveforms(canvas, props.buffers, scale, position);
        drawSegments(canvas, props.info.vocals, props.info.segments, props.singState, props.info.bgm.length, scale, position, props.duration, mousePosition);
        drawHeaders(canvas, props.info.bgm, props.info.vocals, props.volumes, props.pans, props.tmpState, mousePosition);
        drawSeparators(canvas, props.info.bgm.length + props.info.vocals.length);
        drawCursor(canvas, scale, position, props.currentTime / props.duration);
    }, [mousePosition, position, props.buffers, props.currentTime, props.duration, props.info.bgm, props.info.segments, props.info.vocals, props.singState, props.tmpState, props.volumes, scale]);

    const findSegment = useCallback((time: number) => {
        for (let i = 0; i < props.info.segments.length; i++) {
            if (props.info.segments[i].start <= time && time <= props.info.segments[i].end) {
                return i;
            }
        }
    }, [props.info.segments]);

    useEffect(() => {
        const canvas = canvasRef.current!;
        canvas.width = canvas.clientWidth;
        canvas.height = (props.info.bgm.length + props.info.vocals.length) * (LineHeight + LineSpacing);

        const resizeHandler = () => {
            canvas.width = canvas.clientWidth;
            draw();
        };
        window.addEventListener('resize', resizeHandler);

        const mouseDownHandler = (event: MouseEvent) => {
            const x = event.offsetX;
            const y = event.offsetY;

            const timeRate = x2time(x, canvas.width, scale, position);
            const time = timeRate ? timeRate * props.duration : undefined;
            if (time) {
                const vocal = y2track(y, 'segmentSquare');
                if (vocal !== undefined && vocal >= props.info.bgm.length) {
                    const segment = findSegment(time);
                    if (segment !== undefined) props.stateToggleCallback(vocal - props.info.bgm.length, segment);
                } else {
                    props.seekCallback(time);
                    setDraggingInfo({type: 'position'});
                }
                return;
            }

            const [bTrackIndex, buttonIndex] = xy2button(x, y);
            if (bTrackIndex !== undefined && buttonIndex !== undefined) {
                switch (buttonIndex) {
                    case 0:
                        if (bTrackIndex >= props.info.bgm.length) {
                            props.batchStateCallback(bTrackIndex - props.info.bgm.length, false);
                        }
                        break;
                    case 1:
                        if (bTrackIndex >= props.info.bgm.length) {
                            props.batchStateCallback(bTrackIndex - props.info.bgm.length, true);
                        }
                        break;
                    case 2:
                        props.tmpStateToggleCallback(bTrackIndex, 'mute');
                        break;
                    case 3:
                        props.tmpStateToggleCallback(bTrackIndex, 'solo');
                        break;
                }
                return;
            }

            const [sTrackIndex, typeIndex, value] = xy2slider(x, y);
            if (sTrackIndex !== undefined && typeIndex !== undefined && value !== undefined) {
                switch (typeIndex) {
                    case 0:
                        props.volumeChangeCallback(sTrackIndex, value * 2.0);
                        setDraggingInfo({type: 'volume', index: sTrackIndex});
                        break;
                    case 1:
                        props.panChangeCallback(sTrackIndex, value * 2.0 - 1.0);
                        setDraggingInfo({type: 'pan', index: sTrackIndex});
                        break;
                }
            }
        }
        canvas.addEventListener('mousedown', mouseDownHandler);

        const mouseMoveHandler = (event: MouseEvent) => {
            setMousePosition({x: event.offsetX, y: event.offsetY});
            if (draggingInfo.type == 'volume') {
                const [, , volume] = xy2slider(event.offsetX, event.offsetY, true);
                if (volume !== undefined) props.volumeChangeCallback(draggingInfo.index, volume * 2.0);
            } else if (draggingInfo.type == 'pan') {
                const [, , pan] = xy2slider(event.offsetX, event.offsetY, true);
                if (pan !== undefined) props.panChangeCallback(draggingInfo.index, pan * 2.0 - 1.0);
            }
        }
        canvas.addEventListener('mousemove', mouseMoveHandler);

        const mouseUpHandler = () => {
            setDraggingInfo({type: 'none'});
        }
        canvas.addEventListener('mouseup', mouseUpHandler);

        const mouseLeaveHandler = () => {
            setMousePosition(undefined);
            setDraggingInfo({type: 'none'});
        }
        canvas.addEventListener('mouseleave', mouseLeaveHandler);

        const wheelHandler = (event: WheelEvent) => {
            const x = event.offsetX;
            const time = x2time(x, canvas.width, scale, position);
            if (time === undefined) return;

            event.preventDefault();

            let deltaX = event.deltaX;
            let deltaY = event.deltaY;
            if (Math.abs(deltaX) > Math.abs(deltaY)) deltaY = 0;
            else if (Math.abs(deltaX) < Math.abs(deltaY)) deltaX = 0;

            let newPosition = position;

            // deltaY が正→縮小、負→拡大
            if (deltaY != 0) {
                let newScale = scale * (1 - deltaY / 100);
                if (newScale > 100) newScale = 100;
                if (newScale < 1) newScale = 1;
                setScale(newScale);

                const pos = (x - HeaderWidth - 20) / (canvas.width - HeaderWidth - 20);
                newPosition = newScale == 1 ? 0 : (pos - time * newScale) / (1 - newScale);
            }

            // 時間移動
            newPosition += deltaX / 100 / scale;
            if (newPosition < 0) newPosition = 0;
            if (newPosition > 1) newPosition = 1;

            setPosition(newPosition);
        };
        canvas.addEventListener('wheel', wheelHandler, {passive: false});

        draw();

        return () => {
            window.removeEventListener('resize', resizeHandler);
            canvas.removeEventListener('mousedown', mouseDownHandler);
            canvas.removeEventListener('mousemove', mouseMoveHandler);
            canvas.removeEventListener('mouseup', mouseUpHandler);
            canvas.removeEventListener('mouseleave', mouseLeaveHandler);
            canvas.removeEventListener('wheel', wheelHandler);
        }
    }, [draggingInfo, draw, findSegment, position, props, props.info.vocals.length, scale]);

    useEffect(() => {
        const canvas = minimapCanvasRef.current!;
        canvas.width = canvas.clientWidth;
        canvas.height = (props.info.vocals.length) * 8 + 18;

        const update = () => {
            drawMinimap(canvas, props.info.vocals, props.info.segments, props.singState, scale, position, props.duration, props.currentTime);
        }

        const resizeHandler = () => {
            canvas.width = canvas.clientWidth;
            update();
        };
        window.addEventListener('resize', resizeHandler);

        const mouseDownHandler = (event: MouseEvent) => {
            const x = event.offsetX;
            if (x < 5 || x > canvas.width - 5) return;

            const time = (x - 5) / (canvas.width - 10);
            let newPosition = (time * scale - 0.5) / (scale - 1);
            if (newPosition < 0) newPosition = 0;
            if (newPosition > 1) newPosition = 1;
            setPosition(newPosition);
        };
        canvas.addEventListener('mousedown', mouseDownHandler);

        update();

        return () => {
            window.removeEventListener('resize', resizeHandler);
            canvas.removeEventListener('mousedown', mouseDownHandler);
        }
    }, [position, props.currentTime, props.duration, props.info.segments, props.info.vocals, props.info.vocals.length, props.singState, scale]);

    return (
        <>
            <div id="song-tracks">
                <canvas ref={minimapCanvasRef}/>
                <canvas ref={canvasRef}/>
            </div>
        </>
    );
}

export default SongTracks;
