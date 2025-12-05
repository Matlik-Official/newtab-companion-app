import React, { useEffect, useState } from 'react'
import axios from 'axios';
import { Button } from './ui/button';
import { useOS } from '../hooks/useOS';
import { X } from 'lucide-react';
import { ImageTypes } from '../types/electron';

import { motion, AnimatePresence } from 'framer-motion';

type ImmersivePlayingProps = {
    setShowNewTab: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function ImmersivePlaying({ setShowNewTab }: ImmersivePlayingProps) {

    const os = useOS();

    const refreshIntervalMs = 10_000;
    const fadeDuration = 0.7; // seconds (for image fade)
    const authorOffsetMs = 500; // delay before & after image fade

    const [currentImage, setCurrentImage] = useState<ImageTypes>();
    const [nextImage, setNextImage] = useState<ImageTypes>();
    const [isLoading, setIsLoading] = useState(false);
    const [lastSwitchAt, setLastSwitchAt] = useState<number | null>(null);

    const [isAuthorVisible, setIsAuthorVisible] = useState(true);
    const [shouldStartImageFade, setShouldStartImageFade] = useState(false);
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    // -------------------------
    // Fetch & preload image
    // -------------------------
    const fetchNewImage = () => {
        if (isLoading || nextImage) return;
        setIsLoading(true);

        axios
            .get<ImageTypes>('https://api.wallpaper.matlikofficial.com/api/v1/random')
            .then((res) => {
                const preload = new Image();
                preload.src = res.data.original_image;
                preload.onload = () => {
                    setNextImage(res.data);
                };
                preload.onerror = () => setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    };

    useEffect(() => {
        fetchNewImage();
    }, []);

    // -------------------------
    // Image fade + author timing logic
    // -------------------------
    useEffect(() => {
        if (!nextImage) return;

        //
        // FIRST LOAD BEHAVIOR
        //
        if (isFirstLoad) {
            // Allow fade immediately
            setShouldStartImageFade(true);
            setIsAuthorVisible(true);

            // Finish fade
            const timeout = setTimeout(() => {
                setCurrentImage(nextImage);
                setNextImage(undefined);
                setIsLoading(false);
                setLastSwitchAt(Date.now());
                setIsFirstLoad(false); // from now on, cinematic mode enabled
            }, fadeDuration * 1000);

            return () => clearTimeout(timeout);
        }

        //
        // CINEMATIC BEHAVIOR FOR ALL NEXT LOADS
        //

        // 1. Fade author OUT immediately
        setIsAuthorVisible(false);
        setShouldStartImageFade(false);

        // 2. WAIT before starting image fade
        const beforeFadeTimeout = setTimeout(() => {

            // Now allow fade-in of the next image
            setShouldStartImageFade(true);

            // 3. After the image fade duration completes
            const afterFadeTimeout = setTimeout(() => {

                // Swap images
                setCurrentImage(nextImage);
                setNextImage(undefined);
                setIsLoading(false);
                setLastSwitchAt(Date.now());

                // 4. WAIT before author text fades back in
                setTimeout(() => {
                    setIsAuthorVisible(true);
                }, authorOffsetMs);

            }, fadeDuration * 1000);

            return () => clearTimeout(afterFadeTimeout);

        }, authorOffsetMs);

        return () => clearTimeout(beforeFadeTimeout);

    }, [nextImage]);

    // -------------------------
    // Auto-refresh logic
    // -------------------------
    useEffect(() => {
        if (isLoading) return;

        const now = Date.now();
        const elapsed = lastSwitchAt ? now - lastSwitchAt : refreshIntervalMs;
        const wait = lastSwitchAt ? Math.max(refreshIntervalMs - elapsed, 0) : 0;

        const t = setTimeout(fetchNewImage, wait);
        return () => clearTimeout(t);

    }, [lastSwitchAt, isLoading]);


    return (
        <main className="relative min-h-dvh max-h-dvh w-full bg-slate-950 text-slate-50 flex flex-col overflow-hidden">

            {/* ------------------------------
                TOP BAR + Author Fade
            ------------------------------ */}
            <div className='absolute top-1 left-1 right-1 flex items-center gap-1 justify-between drag z-10'>
                <div>
                    {currentImage && (
                        <motion.p
                            className="text-xs font-bold opacity-50 pl-3"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: isAuthorVisible ? 1 : 0 }}
                            transition={{ duration: 0.6, ease: "easeInOut" }}
                        >
                            Image by: {currentImage.author}
                        </motion.p>
                    )}
                </div>

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

            {/* ------------------------------
                IMAGE STACK + FRAMER CROSSFADE
            ------------------------------ */}
            <div className="relative h-svh w-svw overflow-hidden">

                <AnimatePresence>
                    {[currentImage, shouldStartImageFade ? nextImage : null]
                        .filter(Boolean)
                        .map((img) => (
                            <motion.img
                                key={img!.id}
                                src={img!.original_image}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: fadeDuration, ease: "easeInOut" }}
                            />
                        ))}
                </AnimatePresence>

            </div>

        </main>
    );
}
