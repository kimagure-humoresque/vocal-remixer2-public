export interface SongInfo {
    id: string;
    title: string;
    artist: string;
    coverArt: string;
}

export interface SongDetailInfo {
    comment?: string,
    bgm: { data: string, name: string }[],
    vocals: { data: string, name: string, color: string }[],
    artists: string[],
    segments: SegmentInfo[];
}

export interface SegmentInfo {
    start: number,
    end: number,
    singers: number[];
}
