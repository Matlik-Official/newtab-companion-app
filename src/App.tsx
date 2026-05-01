import { useEffect, useMemo, useState } from "react";
import { Settings2, Minus, Square, XCircle } from "lucide-react";
import type { NowPlaying, Settings } from "./types/electron";
import { Button } from "./components/ui/button";
import { useOS } from "./hooks/useOS";
import ImmersiveScreenSaver from "./components/immersive-screen-saver";
import SettingsPanel from "./components/settings-panel";

const fallbackArtwork = "https://newtab.matlikofficial.com/logo.png";

export default function App() {
  const api = window.electronAPI;
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [updatePhase, setUpdatePhase] = useState("idle");
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [showNewTab, setShowNewTab] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [trafficLightPosition, setTrafficLightPosition] = useState<{ x: number; y: number } | null>({ x: 28, y: 28 });
  const os = useOS();

  useEffect(() => {
    if (!api) return;
    api.getSettings().then(setSettings);
    api.getNowPlaying().then(setNowPlaying);
    api.appVersion?.().then((v) => setAppVersion(v || null));
    api.spotifyStatus?.().then((s) => setSpotifyConnected(!!s?.connected));

    const offUpdate = api.onUpdateStatus?.((data: any) => {
      if (!data) return;
      const state = data.status;
      setUpdatePhase(state);
      if (state === "downloading" && data.progress?.percent != null) {
        setUpdateStatus(`Downloading… ${Math.round(data.progress.percent)}%`);
      } else if (state === "downloaded") {
        const v = data.info?.version;
        setUpdateStatus(v ? `v${v} ready` : "Ready to install");
      } else if (state === "available") {
        const v = data.info?.version;
        setUpdateStatus(v ? `v${v} available` : "Update available");
      } else if (state === "checking") {
        setUpdateStatus(null);
      } else if (state === "none") {
        setUpdateStatus("Up to date");
      } else if (state === "error") {
        setUpdateStatus("Update failed");
      }
    });

    const offNowPlaying = api.onNowPlaying?.((data) => setNowPlaying(data));
    const offSettings = api.onSettingsUpdated?.((data) => setSettings(data));
    return () => { offNowPlaying?.(); offSettings?.(); offUpdate?.(); };
  }, [api]);

  useEffect(() => {
    if (!api) return;
    const handleFullscreen = (state: any) => {
      const next = typeof state === "boolean" ? state : !!state?.fullscreen;
      setIsFullscreen(next);
    };
    api.windowIsFullscreen?.().then(handleFullscreen);
    const off = api.onWindowFullscreen?.((data) => handleFullscreen(data));
    return () => { off?.(); };
  }, [api, os]);

  useEffect(() => {
    if (os !== "macOS" || !api) return;
    api.windowTrafficLights?.().then((state) => {
      if (state?.position) setTrafficLightPosition(state.position);
    });
    const off = api.onWindowTrafficLights?.((state) => {
      if (state?.position) setTrafficLightPosition(state.position);
    });
    return () => { off?.(); };
  }, [api, os, isFullscreen]);

  useEffect(() => {
    if (os !== "macOS" || !api || isFullscreen) return;
    if (showNewTab) {
      api.windowSetTrafficLights?.({ visible: false });
    } else {
      const pos = trafficLightPosition || { x: 16, y: 20 };
      api.windowSetTrafficLights?.({ visible: true, position: pos });
    }
  }, [api, os, showNewTab, trafficLightPosition, isFullscreen]);

  const progress = useMemo(() => {
    if (!nowPlaying?.durationMs) return 0;
    return Math.min(100, Math.round((nowPlaying.progressMs / nowPlaying.durationMs) * 100));
  }, [nowPlaying]);

  const toggleSetting = async (key: keyof Settings) => {
    if (!settings) return;
    const updated = await api?.updateSettings?.({ [key]: !settings[key] });
    if (updated) setSettings(updated);
  };

  const handleSpotifyConnect = async () => {
    await api?.startSpotifyLogin?.();
    const np = await api?.getNowPlaying?.();
    if (np) setNowPlaying(np);
    const st = await api?.spotifyStatus?.();
    setSpotifyConnected(!!st?.connected);
  };

  const handleSpotifyDisconnect = async () => {
    await api?.spotifyLogout?.();
    setSpotifyConnected(false);
    setNowPlaying((prev) => (prev?.source === "spotify" ? null : prev));
  };

  return showNewTab ? (
    <ImmersiveScreenSaver
      setShowNewTab={setShowNewTab}
      nowPlaying={nowPlaying}
      showLyrics={settings?.showLyrics ?? true}
      onToggleLyrics={() => toggleSetting("showLyrics")}
    />
  ) : (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 drag select-none shrink-0">
        <span
          className="text-xs text-slate-500 font-medium"
          style={{ marginLeft: os === "macOS" && !isFullscreen ? 80 : undefined }}
        >
          New Tab Companion
        </span>
        <div className="flex items-center gap-1 no-drag">
          <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-100 text-xs" onClick={() => setShowNewTab(true)}>
            NewTab
          </Button>
          <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-100 h-8 w-8 p-0" onClick={() => setShowSettings(true)}>
            <Settings2 className="h-4 w-4" />
          </Button>
          {os !== "macOS" && (
            <>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-100" onClick={() => api?.windowMinimize?.()}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-100" onClick={() => api?.windowMaximize?.()}>
                <Square className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-rose-400" onClick={() => api?.windowClose?.()}>
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Now playing */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex gap-6 items-center w-full max-w-md">
          <img
            src={nowPlaying?.artworkUrl || fallbackArtwork}
            alt={nowPlaying?.title || "Artwork"}
            className="h-32 w-32 rounded-lg object-cover shrink-0 shadow-lg"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
              {nowPlaying?.source || "—"}
            </p>
            <p className="text-xl font-semibold leading-tight truncate">
              {nowPlaying?.title || "Nothing playing"}
            </p>
            <p className="text-sm text-slate-400 truncate mt-0.5">
              {nowPlaying?.artist || "—"}
            </p>
            <p className="text-xs text-slate-600 truncate mt-0.5">
              {nowPlaying?.album || ""}
            </p>
            <div className="mt-4 h-0.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-500 rounded-full transition-all duration-1000"
                style={{ width: `${progress}%` }}
              />
            </div>
            {!spotifyConnected && (
              <button
                className="mt-3 text-xs text-slate-600 hover:text-slate-300 transition-colors"
                onClick={handleSpotifyConnect}
              >
                Connect Spotify →
              </button>
            )}
          </div>
        </div>
      </div>

      {showSettings && settings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          settings={settings}
          appVersion={appVersion}
          spotifyConnected={spotifyConnected}
          updatePhase={updatePhase}
          updateStatus={updateStatus}
          onToggleSetting={toggleSetting}
          onSpotifyConnect={handleSpotifyConnect}
          onSpotifyDisconnect={handleSpotifyDisconnect}
          onCheckForUpdates={() => {
            setUpdatePhase("checking");
            setUpdateStatus(null);
            api?.checkForUpdates?.().catch(() => {
              setUpdatePhase("error");
              setUpdateStatus("Check failed");
            });
          }}
          onDownloadUpdate={() => {
            setUpdatePhase("downloading");
            setUpdateStatus("Starting…");
            api?.downloadUpdate?.().catch(() => {
              setUpdatePhase("error");
              setUpdateStatus("Download failed");
            });
          }}
          onInstallUpdate={() => api?.installUpdate?.()}
        />
      )}
    </main>
  );
}
