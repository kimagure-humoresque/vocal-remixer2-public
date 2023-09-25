import React from 'react'
import ReactDOM from 'react-dom/client'
import {createBrowserRouter, RouterProvider} from 'react-router-dom';

import './default.sass'
import ListView, {listViewLoader} from './ListView.tsx';
import SongView, {songViewLoader} from './SongView.tsx';

const router = createBrowserRouter([
    {
        path: '/',
        element: <ListView/>,
        loader: listViewLoader,
    },
    {
        path: '/songs/:id',
        element: <SongView/>,
        loader: songViewLoader,
    },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <RouterProvider router={router}/>
    </React.StrictMode>,
)
