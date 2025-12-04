import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Zap, Wifi, Music, Settings2 } from "lucide-react";
import type { NowPlaying, Settings } from "./types/electron";
import { Button } from "./components/ui/button";

const fallbackArtwork =
  "https://dummyimage.com/320x320/0f172a/94a3b8.png&text=No+Artwork";

export default function App() {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState("Connecting to Electron bridge…");

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) {
      setStatus("Preload bridge missing");
      return;
    }
    api.ping().then(() => setStatus("Bridge live"));
    api.getSettings().then(setSettings);
    api.getNowPlaying().then(setNowPlaying);

    const offNowPlaying = api.onNowPlaying?.((data) => setNowPlaying(data));
    const offSettings = api.onSettingsUpdated?.((data) => setSettings(data));

    return () => {
      offNowPlaying?.();
      offSettings?.();
    };
  }, []);

  const progress = useMemo(() => {
    if (!nowPlaying) return 0;
    if (!nowPlaying.durationMs) return 0;
    return Math.min(
      100,
      Math.round((nowPlaying.progressMs / nowPlaying.durationMs) * 100)
    );
  }, [nowPlaying]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-6 py-12 text-slate-100">
      <div className="flex items-center justify-between rounded-2xl border border-slate-800/70 bg-slate-900/60 px-5 py-3">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <Zap className="h-4 w-4 text-cyan-300" />
          <span>Electron companion</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-300">
            <Wifi className="h-3 w-3" />
            {status}
          </span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-500/10 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.08em] text-slate-400">
                Now Playing
              </p>
              <h1 className="text-3xl font-bold">
                {nowPlaying?.title || "Nothing playing"}
              </h1>
              <p className="text-slate-300">
                {nowPlaying?.artist || "Start playback to see details"}
              </p>
            </div>
            <span className="rounded-full border border-slate-800 bg-slate-950/60 px-3 py-1 text-xs text-slate-300">
              {nowPlaying?.source || "none"}
            </span>
          </div>

          <div className="flex gap-4">
            <div className="h-40 w-40 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60 shadow-lg shadow-cyan-500/10">
              <img
                src={nowPlaying?.artworkUrl || fallbackArtwork}
                alt={nowPlaying?.title || "Artwork"}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col justify-between">
              <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-200">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-slate-400">
                  <Music className="h-3.5 w-3.5" />
                  Track details
                </div>
                <p>
                  <span className="text-slate-400">Album:</span>{" "}
                  {nowPlaying?.album || "—"}
                </p>
                <p>
                  <span className="text-slate-400">Artist:</span>{" "}
                  {nowPlaying?.artist || "—"}
                </p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-900/70 p-6 shadow-xl shadow-cyan-500/10 backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Settings2 className="h-5 w-5 text-cyan-300" />
            Settings snapshot
          </div>
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
            <div className="flex items-center justify-between">
              <span>Prefer Spotify</span>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs">
                {settings?.preferSpotify ? "On" : "Off"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Prefer Cider</span>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs">
                {settings?.preferCider ? "On" : "Off"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Autostart</span>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs">
                {settings?.autostart ? "On" : "Off"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>API Port</span>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs">
                {settings?.apiPort ?? "—"}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => window.electronAPI?.updateSettings?.({ apiPort: 8787 })}
            >
              Quick set API 8787
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={async () => {
                await window.electronAPI?.startSpotifyLogin?.();
                const np = await window.electronAPI?.getNowPlaying?.();
                if (np) setNowPlaying(np);
              }}
            >
              Connect Spotify
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
