import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { NowPlaying } from '../types/electron';
import { MarqueeText } from './marquee-text';

type ImmersiveSongDataProps = {
    nowPlaying: NowPlaying | null;
    themeColor: string;
    animationDuration?: number;
};

export default function ImmersiveSongData({ nowPlaying, themeColor, animationDuration = 1 }: ImmersiveSongDataProps) {
    const [displayTrack, setDisplayTrack] = useState<NowPlaying | null>(nowPlaying);
    const prefersReducedMotion = useReducedMotion();
    const titleRef = useRef<HTMLParagraphElement | null>(null);
    const titleContainerRef = useRef<HTMLDivElement | null>(null);
    const [titleScrollDistance, setTitleScrollDistance] = useState(0);

    // Keep the last known track to avoid flicker when data briefly disappears.
    useEffect(() => {
        if (nowPlaying) {
            setDisplayTrack(nowPlaying);
        }
    }, [nowPlaying]);

    const artwork = displayTrack?.artworkUrl || 'https://newtab.matlikofficial.com/logo.png';
    const alt = displayTrack ? `${displayTrack.title} by ${displayTrack.artist}` : 'Now playing artwork';
    const contentKey = displayTrack
        ? `${displayTrack.title}-${displayTrack.artist}-${displayTrack.album}-${displayTrack.artworkUrl}`
        : 'no-track';

    const transition = { duration: animationDuration, ease: [0.25, 0.1, 0.25, 1] as const };
    const textStagger = prefersReducedMotion ? 0 : 0.08;

    const baseInitial = prefersReducedMotion
        ? { opacity: 0 }
        : { opacity: 0, x: 40, scale: 0.98, filter: 'blur(6px)' };
    const baseAnimate = prefersReducedMotion
        ? { opacity: 1 }
        : { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' };
    const baseExit = prefersReducedMotion
        ? { opacity: 0 }
        : { opacity: 0, x: -40, scale: 0.98, filter: 'blur(6px)' };

    const marqueeDuration = Math.max(6, titleScrollDistance / 25);

    return (
        <div className="flex gap-4 h-fit w-fit rounded-full relative items-center">
            <AnimatePresence mode="popLayout">
                <motion.div
                    key={contentKey}
                    initial={baseInitial}
                    animate={baseAnimate}
                    exit={baseExit}
                    transition={transition}
                    className="relative flex items-center gap-4 h-24 w-fit rounded-full"
                >
                    <div className="relative pl-4 pr-5 py-2 flex items-center gap-4 h-full w-fit rounded-full bg-black/50 border border-white/25 transition-all duration-300 backdrop-blur">
                        <div className="relative h-16 w-16 shrink-0">
                            <img
                                src={artwork}
                                alt={alt}
                                className="absolute inset-0 h-full w-full rounded-full object-cover blur-sm scale-110 opacity-80"
                            />
                            <img
                                src={artwork}
                                alt={alt}
                                className="absolute inset-0 h-full w-full rounded-full object-cover shadow-lg"
                            />
                        </div>
                        <div className="min-w-[220px] max-w-[320px] w-full rounded-l-md rounded-r-full flex flex-col justify-center gap-0.5">
                            <div
                                ref={titleContainerRef}
                                className="relative overflow-hidden"
                            >
                                <MarqueeText text={displayTrack?.title ? displayTrack?.title : '-'} />
                            </div>
                            <p
                                className="text-sm font-semibold opacity-70"
                            >
                                {displayTrack?.artist ? displayTrack?.artist : '-'}
                            </p>
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
