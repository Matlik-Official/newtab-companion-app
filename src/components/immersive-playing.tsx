import React, { useEffect, useState } from 'react'
import axios from 'axios';
import { Button } from './ui/button';
import { useOS } from '../hooks/useOS';
import { X } from 'lucide-react';
import { ImageTypes } from '../types/electron';

type ImmersivePlayingProps = {
    setShowNewTab: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function ImmersivePlaying({ setShowNewTab }: ImmersivePlayingProps) {
    const os = useOS();
    // tweak this value to change how often we refresh
    const refreshIntervalMs = 10_000;
    const [currentImage, setCurrentImage] = useState<ImageTypes>()
    const [newImage, setNewImage] = useState<ImageTypes>()
    const [originalLoaded, setOriginalLoaded] = useState(false);

    function fetchImage() {
        axios
            .get<ImageTypes>('https://api.wallpaper.matlikofficial.com/api/v1/random')
            .then((res) => setNewImage(res.data))
            .catch((error) => console.error('Failed to fetch image', error));
    }

    useEffect(() => {
        // initial fetch + interval for subsequent refreshes
        fetchImage();
        const intervalId = setInterval(fetchImage, refreshIntervalMs);
        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        // only swap once the new image has fully arrived
        if (newImage) {
            setCurrentImage(newImage);
            setNewImage(undefined);
            setOriginalLoaded(false);
        }
    }, [newImage]);

    useEffect(() => {
        if (!currentImage?.original_image) return;
        let canceled = false;
        const img = new Image();
        img.src = currentImage.original_image;
        img.onload = () => {
            if (!canceled) setOriginalLoaded(true);
        };
        img.onerror = () => {
            if (!canceled) setOriginalLoaded(false);
        };
        return () => {
            canceled = true;
            img.onload = null;
            img.onerror = null;
        };
    }, [currentImage]);

    const displayedSrc = originalLoaded
        ? currentImage?.original_image
        : currentImage?.thumbnail_image;

    return (
        <main className="min-h-dvh max-h-dvh w-full bg-slate-950 text-slate-50 flex flex-col">
            <div className='absolute top-1 left-1 right-1 flex items-center gap-1 justify-between drag'>
                {
                    currentImage && (
                        <p className='text-xs font-bold opacity-50 pl-3'>
                            Image by: {currentImage.author}
                        </p>
                    )
                }
                <Button
                    variant="outline"
                    size="icon"
                    className="gap-2 no-drag scale-75 pointer-events-auto opacity-10 hover:opacity-80 transition-all"
                    onClick={(e) => {
                        e.preventDefault();
                        setShowNewTab(false);
                    }}
                >
                    <X />
                </Button>
            </div>
            {displayedSrc ? (
                <img
                    src={displayedSrc}
                    alt={currentImage?.title}
                    className=' h-svh w-svw object-cover'
                />
            ) : null}
        </main>
    )
}
