import { useEffect, useState } from "react";

export function useOS() {
    const [os, setOs] = useState("Unknown");

    useEffect(() => {
        const ua = navigator.userAgent;

        if (/Windows/i.test(ua)) setOs("Windows");
        else if (/Macintosh|Mac OS X/i.test(ua)) setOs("macOS");
        else if (/Linux/i.test(ua)) setOs("Linux");
        else if (/Android/i.test(ua)) setOs("Android");
        else if (/iPhone|iPad|iPod/i.test(ua)) setOs("iOS");
    }, []);

    return os;
}
