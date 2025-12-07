import React from 'react';
import { NowPlaying } from '../types/electron';

type ImmersiveSongDataProps = {
    nowPlaying: NowPlaying | null;
    themeColor: string;
};

export default function ImmersiveSongData({ nowPlaying, themeColor }: ImmersiveSongDataProps) {
    const artwork = nowPlaying?.artworkUrl || 'https://newtab.matlikofficial.com/logo.png';
    const alt = nowPlaying ? `${nowPlaying.title} by ${nowPlaying.artist}` : 'Now playing artwork';

    return (
        <div className={` flex gap-4 h-fit w-fit rounded-full relative`}>
            <img src={artwork} alt={alt} className='absolute left-1 max-h-[84px] rounded-full aspect-square' />
            <div className={`inset-0 p-1 flex gap-4 h-fit w-fit rounded-full bg-black/50 border border-white/25 transition-all duration-300 backdrop-blur`}>
                <img src={artwork} alt={alt} className='max-h-20 rounded-full aspect-square' />
                <div className='min-w-32 w-fit rounded-l-md rounded-r-full p-2 pr-4 pl-0 flex flex-col justify-center'>
                    <p className='font-bold text-lg'>{nowPlaying?.title}</p>
                    <p className='text-sm font-semibold opacity-50'>{nowPlaying?.artist}</p>
                </div>
            </div>
        </div>
    );
}
