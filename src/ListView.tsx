import logo from './assets/logo.svg';
import './ListView.sass';
import {SongInfo} from './domain.ts';

import {LoaderFunction, useLoaderData, useNavigate} from 'react-router';

import FooterView from './Footer.tsx';

type LoaderDataType = {
    list: SongInfo[]
};

export const listViewLoader: LoaderFunction = async ({params}) => {
    const list_type = params.list_type ? `list_${params.list_type}` : 'list';

    const listResponse = await fetch(`/data/${list_type}.json`);
    const list = await listResponse.json() as SongInfo[];

    return {list};
}

function ListView() {
    const {list} = useLoaderData() as LoaderDataType
    const navigate = useNavigate();

    return (
        <>
            <div id="logo-container">
                <img src={logo} className="logo" alt="Logo"/>
            </div>
            <div id="list-container">
                <div id="list">
                    {list.map((song) => (
                        <div className="list-song-item" onClick={() => navigate(`/songs/${song.id}`)}>
                            <div id="cover-art">
                                <img src={`/data/${song.coverArt}`} alt="Cover Art"/>
                            </div>
                            <div id="song-meta">
                                <p id="song-meta-title">{song.title}</p>
                                <p id="song-meta-artist">{song.artist}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <FooterView/>
        </>
    )
}

export default ListView
