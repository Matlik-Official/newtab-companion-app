import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

function parseLRC(lrc: string) {
    const lines = lrc.split("\n");
    const result: { time: number; text: string }[] = [];

    for (const line of lines) {
        const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
        if (!match) continue;

        const min = parseInt(match[1]);
        const sec = parseFloat(match[2]);
        const time = (min * 60 + sec) * 1000;

        result.push({ time, text: match[3].trim() });
    }

    return result.sort((a, b) => a.time - b.time);
}

function getCurrentIndex(lyrics: { time: number; text: string }[], currentMs: number) {
    for (let i = lyrics.length - 1; i >= 0; i--) {
        if (currentMs >= lyrics[i].time) return i;
    }
    return -1;
}

export default function SyncedLyrics({
    nowPlaying,
    themeColor,
    animationDuration,
    enableKaraoke = false,
}: {
    nowPlaying: {
        title: string;
        artist: string;
        album: string;
        artworkUrl: string;
        progressMs: number;
        durationMs: number;
        isPlaying: boolean;
        source: "spotify" | "cider" | "none";
    };
    themeColor: string;
    animationDuration: number;
    enableKaraoke?: boolean;
}) {
    const [lyrics, setLyrics] = useState<{ time: number; text: string }[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [loading, setLoading] = useState(false);

    const [smoothProgress, setSmoothProgress] = useState(0);
    const lastUpdateRef = useRef(Date.now());

    const minPillWidth = 288; // matches previous w-72
    const textMeasureRef = useRef<HTMLSpanElement>(null);
    const [pillWidth, setPillWidth] = useState(minPillWidth);

    useEffect(() => {
        if (loading || !textMeasureRef.current) {
            setPillWidth(minPillWidth);
            return;
        }
        const textW = textMeasureRef.current.offsetWidth;
        setPillWidth(Math.max(minPillWidth, textW + 40)); // 40px = px-5 padding both sides
    }, [currentIndex, loading]);

    useEffect(() => {
        if (!nowPlaying?.title || !nowPlaying?.artist) return;

        const fetchLyrics = async () => {
            setLoading(true);
            try {
                const query = new URLSearchParams({
                    track_name: nowPlaying.title,
                    artist_name: nowPlaying.artist,
                });

                const res = await fetch(`https://lrclib.net/api/get?${query}`);
                const data = await res.json();

                setLyrics(data?.syncedLyrics ? parseLRC(data.syncedLyrics) : []);
            } catch {
                setLyrics([]);
            }
            setLoading(false);
        };

        fetchLyrics();
    }, [nowPlaying?.title, nowPlaying?.artist]);

    useEffect(() => {
        lastUpdateRef.current = Date.now();
        setSmoothProgress(nowPlaying.progressMs || 0);
    }, [nowPlaying.progressMs]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const delta = now - lastUpdateRef.current;
            lastUpdateRef.current = now;

            if (nowPlaying.isPlaying) {
                setSmoothProgress((prev) => prev + delta);
            }
        }, 50);

        return () => clearInterval(interval);
    }, [nowPlaying.isPlaying]);

    useEffect(() => {
        if (!lyrics.length) return;
        setCurrentIndex(getCurrentIndex(lyrics, smoothProgress));
    }, [smoothProgress, lyrics]);

    function getKaraokeProgress(i: number) {
        const current = lyrics[i];
        const next = lyrics[i + 1];
        if (!current || !next) return 0;
        const elapsed = smoothProgress - current.time;
        return Math.min(1, Math.max(0, elapsed / (next.time - current.time)));
    }

    if (!loading && lyrics.length === 0) return null;

    const currentLine = lyrics[currentIndex];
    const textColor = themeColor === "white" ? "#000000" : "#ffffff";
    const dimColor = themeColor === "white" ? "#00000055" : "#ffffff55";

    return (
        <>
        {/* off-screen span used only to measure text width */}
        <span
            ref={textMeasureRef}
            aria-hidden
            className="fixed top-0 left-0 -translate-y-full text-sm font-semibold whitespace-nowrap pointer-events-none opacity-0"
        >
            {currentLine?.text ?? ""}
        </span>

        <motion.div
            animate={{ width: pillWidth }}
            transition={{ duration: animationDuration, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative h-14 overflow-hidden rounded-full"
        >
            <motion.div
                className="absolute inset-0 backdrop-blur-md"
                animate={{ backgroundColor: themeColor === "white" ? "#ffffff80" : "#00000080" }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
            />

            <div className="relative h-full flex items-center px-5">
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="flex gap-1.5 px-2"
                        >
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    className="w-1 h-1 rounded-full"
                                    style={{ backgroundColor: textColor }}
                                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                                />
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                            transition={{ duration: animationDuration, ease: [0.25, 0.1, 0.25, 1] }}
                            className="text-sm font-semibold whitespace-nowrap"
                            style={{ color: textColor }}
                        >
                            {enableKaraoke && currentLine
                                ? currentLine.text.split(" ").map((word, idx, arr) => {
                                    const wordProgress = getKaraokeProgress(currentIndex) * arr.length;
                                    return (
                                        <span
                                            key={idx}
                                            style={{
                                                color: idx < wordProgress ? textColor : dimColor,
                                                transition: "color 0.1s linear",
                                            }}
                                        >
                                            {word + " "}
                                        </span>
                                    );
                                })
                                : currentLine?.text ?? ""}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
        </>
    );
}
