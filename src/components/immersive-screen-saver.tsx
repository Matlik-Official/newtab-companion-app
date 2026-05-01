import React, { useEffect, useState } from 'react'
import axios from 'axios';
import { X, Mic, MicOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageTypes, NowPlaying } from '../types/electron';
import { useOS } from '../hooks/useOS';
import { Button } from './ui/button';
import ImmersiveSongData from './immersive-song-data';
import SyncedLyrics from './synced-lyrics';

type ImmersivePlayingProps = {
    setShowNewTab: React.Dispatch<React.SetStateAction<boolean>>;
    nowPlaying: NowPlaying | null;
    showLyrics: boolean;
    onToggleLyrics: () => void;
};

export default function ImmersiveScreenSaver({ setShowNewTab, nowPlaying, showLyrics, onToggleLyrics }: ImmersivePlayingProps) {
    const os = useOS();

    const refreshIntervalMs = 10_000;
    const fadeDuration = 0.7;          // image fade duration
    const scaleZoom = 1.02;            // image starts/ends slightly larger
    const authorOffsetMs = 1_000;       // early fade out & late fade in timing

    const [currentImage, setCurrentImage] = useState<ImageTypes>();
    const [nextImage, setNextImage] = useState<ImageTypes>();
    const [isLoading, setIsLoading] = useState(false);
    const [lastSwitchAt, setLastSwitchAt] = useState<number | null>(null);

    const [isAuthorVisible, setIsAuthorVisible] = useState(true);
    const [shouldStartImageFade, setShouldStartImageFade] = useState(false);
    const [isFirstLoad, setIsFirstLoad] = useState(true);

const [authorColor, setAuthorColor] = useState<"white" | "black">("white");
    const [songDataColor, setSongDataColor] = useState<"white" | "black">("white");
    const [btnColor, setBtnColor] = useState<"white" | "black">("white");
    const [lyricsColor, setLyricsColor] = useState<"white" | "black">("white");

    // -------------------------------------------------------
    // Utility: Calculate luminance
    // -------------------------------------------------------
    function getPerceivedBrightness(r: number, g: number, b: number) {
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // -------------------------------------------------------
    // Utility: Analyze image pixel behind author text
    // -------------------------------------------------------
    type SamplePoint = { x: number; y: number };

    // Returns "white" or "black" depending on the brightness at a given point on the image.
    // `x`/`y` are normalized (0–1), so (0, 0) is top-left, (1, 1) is bottom-right.
    function analyzeBackgroundAtPoint(imageUrl: string, point: SamplePoint): Promise<"white" | "black"> {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = imageUrl;

            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                if (!ctx) return resolve("white");

                canvas.width = img.width;
                canvas.height = img.height;

                ctx.drawImage(img, 0, 0);

                // Sample point for the overlay
                const sampleX = Math.round(Math.min(Math.max(point.x, 0), 1) * img.width);
                const sampleY = Math.round(Math.min(Math.max(point.y, 0), 1) * img.height);

                const { data } = ctx.getImageData(sampleX, sampleY, 1, 1);
                const [r, g, b] = data;

                const brightness = getPerceivedBrightness(r, g, b);
                resolve(brightness < 128 ? "white" : "black");
            };

            img.onerror = () => resolve("white");
        });
    }

    function analyzeOverlayColors(imageUrl: string) {
        // Author text is top-left-ish, song data sits bottom-right.
        const authorPoint = { x: 0.05, y: 0.05 };
        const songPoint = { x: 0.1, y: 0.9 };
        const btnPoint = { x: 0.95, y: 0.05 };
        const lyricsPoint = { x: 0.9, y: 0.9 };

        analyzeBackgroundAtPoint(imageUrl, authorPoint).then(setAuthorColor);
        analyzeBackgroundAtPoint(imageUrl, songPoint).then(setSongDataColor);
        analyzeBackgroundAtPoint(imageUrl, btnPoint).then(setBtnColor);
        analyzeBackgroundAtPoint(imageUrl, lyricsPoint).then(setLyricsColor);
    }

    // -------------------------------------------------------
    // Fetch + preload image
    // -------------------------------------------------------
    const fetchNewImage = () => {
        if (isLoading || nextImage) return;
        setIsLoading(true);

        axios
            .get<ImageTypes>('https://api.wallpaper.matlikofficial.com/api/v1/random')
            .then((res) => {
                const preload = new Image();
                preload.src = res.data.original_image;
                preload.onload = () => setNextImage(res.data);
                preload.onerror = () => setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    };

    useEffect(() => {
        fetchNewImage();
    }, []);

    // -------------------------------------------------------
    // Image + text cinematic timing logic
    // -------------------------------------------------------
    useEffect(() => {
        if (!nextImage) return;

        //
        // FIRST LOAD — immediate fade, no cinematic delays
        //
        if (isFirstLoad) {
            setShouldStartImageFade(true);
            setIsAuthorVisible(true);

            const timeout = setTimeout(() => {
                setCurrentImage(nextImage);
                setNextImage(undefined);
                setIsLoading(false);
                setLastSwitchAt(Date.now());
                setIsFirstLoad(false);

                analyzeOverlayColors(nextImage.original_image);

            }, fadeDuration * 1000);

            return () => clearTimeout(timeout);
        }

        //
        // CINEMATIC MODE (after first fade)
        //

        // 1. Immediately hide author text
        setIsAuthorVisible(false);
        setShouldStartImageFade(false);

        // 2. Wait BEFORE starting image fade
        const beforeFadeTimeout = setTimeout(() => {

            setShouldStartImageFade(true); // now allow fade-in

            // 3. Wait image fade time
            const afterFadeTimeout = setTimeout(() => {

                // Swap images
                setCurrentImage(nextImage);
                setNextImage(undefined);
                setIsLoading(false);
                setLastSwitchAt(Date.now());

                analyzeOverlayColors(nextImage.original_image);

                // 4. Wait BEFORE showing author text again
                setTimeout(() => {
                    setIsAuthorVisible(true);
                }, authorOffsetMs);

            }, fadeDuration * 1000);

            return () => clearTimeout(afterFadeTimeout);

        }, authorOffsetMs);

        return () => clearTimeout(beforeFadeTimeout);

    }, [nextImage]);

    // -------------------------------------------------------
    // Automatic refresh timer
    // -------------------------------------------------------
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

            {/* ------------------------------------------
                TOP BAR
            ------------------------------------------- */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 drag select-none z-20">

                <motion.p
                    className="text-xs font-medium"
                    initial={{ opacity: 0 }}
                    animate={{
                        opacity: isAuthorVisible ? 0.4 : 0,
                        color: authorColor === "white" ? "#ffffff" : "#000000"
                    }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                >
                    {currentImage?.author ?? ""}
                </motion.p>

                <div className="flex items-center gap-1 no-drag">
                    <motion.button
                        className="h-8 w-8 flex items-center justify-center pointer-events-auto opacity-30 hover:opacity-70 transition-opacity"
                        onClick={onToggleLyrics}
                        animate={{ color: authorColor === "white" ? "#ffffff" : "#000000" }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                    >
                        {showLyrics ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    </motion.button>

                    <motion.button
                        className="h-8 w-8 flex items-center justify-center pointer-events-auto opacity-30 hover:opacity-70 transition-opacity"
                        onClick={(e: any) => { e.preventDefault(); setShowNewTab(false); }}
                        animate={{ color: authorColor === "white" ? "#ffffff" : "#000000" }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                    >
                        <X className="h-4 w-4" />
                    </motion.button>
                </div>
            </div>

            <div className='absolute bottom-0 left-0 right-0 flex items-end justify-between z-10 p-4'>
                <div className="shrink-0">
                    {nowPlaying && <ImmersiveSongData nowPlaying={nowPlaying} themeColor={songDataColor} />}
                </div>
                <AnimatePresence>
                    {showLyrics && nowPlaying && (
                        <motion.div
                            className="shrink-0"
                            initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                            exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                        >
                            <SyncedLyrics
                                nowPlaying={nowPlaying}
                                themeColor={lyricsColor}
                                animationDuration={0.3}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ------------------------------------------
                IMAGE CROSSFADE (Framer Motion)
            ------------------------------------------- */}
            <div className="relative h-svh w-svw overflow-hidden">
                <AnimatePresence>
                    {!currentImage && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: fadeDuration, ease: "easeInOut" }}
                            className="absolute inset-0 flex items-center justify-center"
                        >
                            <div className="flex gap-2">
                                {[0, 1, 2].map((i) => (
                                    <motion.div
                                        key={i}
                                        className="w-1.5 h-1.5 rounded-full bg-white/40"
                                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {[currentImage, shouldStartImageFade ? nextImage : null]
                        .filter(Boolean)
                        .map((img) => (
                            <motion.img
                                key={img!.id}
                                src={img!.original_image}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover"
                                initial={{ opacity: 0, scale: scaleZoom }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: scaleZoom }}
                                transition={{ duration: fadeDuration, ease: "easeInOut" }}
                            />
                        ))}
                </AnimatePresence>
            </div>
        </main>
    );
}
