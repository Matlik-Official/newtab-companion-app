import React, { useEffect, useState } from 'react'
import axios from 'axios';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageTypes } from './types/electron';
import { useOS } from './hooks/useOS';
import { Button } from './components/ui/button';

type ImmersivePlayingProps = {
    setShowNewTab: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function ImmersivePlaying({ setShowNewTab }: ImmersivePlayingProps) {
    const os = useOS();

    const refreshIntervalMs = 10_000;
    const fadeDuration = 0.7;          // image fade duration
    const scaleZoom = 1.02;            // image starts/ends slightly larger
    const authorOffsetMs = 1000;       // early fade out & late fade in timing

    const [currentImage, setCurrentImage] = useState<ImageTypes>();
    const [nextImage, setNextImage] = useState<ImageTypes>();
    const [isLoading, setIsLoading] = useState(false);
    const [lastSwitchAt, setLastSwitchAt] = useState<number | null>(null);

    const [isAuthorVisible, setIsAuthorVisible] = useState(true);
    const [shouldStartImageFade, setShouldStartImageFade] = useState(false);
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    const [authorColor, setAuthorColor] = useState<"white" | "black">("white");

    // -------------------------------------------------------
    // Utility: Calculate luminance
    // -------------------------------------------------------
    function getPerceivedBrightness(r: number, g: number, b: number) {
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // -------------------------------------------------------
    // Utility: Analyze image pixel behind author text
    // -------------------------------------------------------
    function analyzeAuthorBackground(imageUrl: string): Promise<"white" | "black"> {
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

                // Sample point behind author text position
                const sampleX = 20;
                const sampleY = 30;

                const { data } = ctx.getImageData(sampleX, sampleY, 1, 1);
                const [r, g, b] = data;

                const brightness = getPerceivedBrightness(r, g, b);
                resolve(brightness < 128 ? "white" : "black");
            };

            img.onerror = () => resolve("white");
        });
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

                // Analyze author background color
                analyzeAuthorBackground(nextImage.original_image).then(color => {
                    setAuthorColor(color);
                });

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

                // Analyze text background color
                analyzeAuthorBackground(nextImage.original_image).then(color => {
                    setAuthorColor(color);
                });

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
                TOP BAR (Author text with adaptive color)
            ------------------------------------------- */}
            <div className="absolute top-1 left-1 right-1 flex items-center gap-1 justify-between drag z-10">

                <div>
                  {currentImage && (
                      <motion.p
                          className="text-sm font-bold pl-3"
                          initial={{ opacity: 0 }}
                          animate={{
                              opacity: isAuthorVisible ? .5 : 0,
                              color: authorColor === "white" ? "#ffffff" : "#000000"
                          }}
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
                    onClick={(e: any) => {
                        e.preventDefault();
                        setShowNewTab(false);
                    }}
                >
                    <X />
                </Button>
            </div>

            {/* ------------------------------------------
                IMAGE CROSSFADE (Framer Motion)
            ------------------------------------------- */}
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
