import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Wifi,
  Music,
  Settings2,
  X,
  Power,
  SlidersHorizontal,
  Minus,
  Square,
  XCircle,
  Outdent,
  ExternalLink
} from "lucide-react";
import type { NowPlaying, Settings } from "./types/electron";
import { Button } from "./components/ui/button";
import { useOS } from "./hooks/useOS";
import ImmersivePlaying from "./components/immersive-playing";

const fallbackArtwork =
  "https://dummyimage.com/320x320/0f172a/94a3b8.png&text=No+Artwork";

export default function App() {
  const api = window.electronAPI;
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [serviceTracks, setServiceTracks] = useState<Record<string, NowPlaying>>(
    {}
  );
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState("Connecting…");
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("Idle");
  const [appVersion, setAppVersion] = useState<string | null>(null);

  const [showNewTab, setShowNewTab] = useState<boolean>(true);
  const os = useOS();


  useEffect(() => {
    if (!api) {
      setStatus("Preload missing");
      return;
    }
    api.ping().then(() => setStatus("Bridge live"));
    api.getSettings().then(setSettings);
    api.getNowPlaying().then((np) => {
      setNowPlaying(np);
      if (np?.source) setServiceTracks((prev) => ({ ...prev, [np.source]: np }));
    });
    api.appVersion?.().then((v) => setAppVersion(v || null));
    api.spotifyStatus?.().then((s) => setSpotifyConnected(!!s?.connected));
    const offUpdate = api.onUpdateStatus?.((data: any) => {
      if (!data) return;
      const state = data.status;
      if (state === "downloading" && data.progress?.percent != null) {
        setUpdateStatus(`Downloading ${Math.round(data.progress.percent)}%`);
      } else if (state === "downloaded") {
        setUpdateStatus("Update ready - restart to install");
      } else if (state === "available") {
        setUpdateStatus("Update available - downloading");
      } else if (state === "checking") {
        setUpdateStatus("Checking for updates...");
      } else if (state === "none") {
        setUpdateStatus("Up to date");
      } else if (state === "error") {
        setUpdateStatus("Update error");
      }
    });

    const offNowPlaying = api.onNowPlaying?.((data) => {
      setNowPlaying(data);
      if (data?.source) {
        setServiceTracks((prev) => ({ ...prev, [data.source]: data }));
      }
    });
    const offSettings = api.onSettingsUpdated?.((data) => setSettings(data));
    return () => {
      offNowPlaying?.();
      offSettings?.();
      offUpdate?.();
    };
  }, [api]);

  const progress = useMemo(() => {
    if (!nowPlaying) return 0;
    if (!nowPlaying.durationMs) return 0;
    return Math.min(
      100,
      Math.round((nowPlaying.progressMs / nowPlaying.durationMs) * 100)
    );
  }, [nowPlaying]);

  const toggleSetting = async (key: keyof Settings) => {
    if (!settings) return;
    const updated = await api?.updateSettings?.({ [key]: !settings[key] });
    if (updated) setSettings(updated);
  };

  const handleSpotifyConnect = async () => {
    await api?.startSpotifyLogin?.();
    const np = await api?.getNowPlaying?.();
    if (np) {
      setNowPlaying(np);
      if (np.source) setServiceTracks((prev) => ({ ...prev, [np.source]: np }));
    }
    const st = await api?.spotifyStatus?.();
    setSpotifyConnected(!!st?.connected);
  };

  const handleSpotifyDisconnect = async () => {
    await api?.spotifyLogout?.();
    setSpotifyConnected(false);
    setNowPlaying((prev) => (prev && prev.source === "spotify" ? null : prev));
  };

  return showNewTab ? (
    <ImmersivePlaying setShowNewTab={setShowNewTab} />
  ) : (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <header className="flex select-none items-center justify-between bg-slate-950/80 p-4 backdrop-blur drag sticky top-0 z-10">
        <div className={`flex items-center gap-3 text-sm text-slate-300 ${os == "macOS" && 'ml-14'}`}>
          <img src="https://newtab.matlikofficial.com/logo.png" alt="NewTab Logo" className="h-9 w-9 rounded-sm" />
          <div className="text-left leading-tight">
            <p className="text-sm font-semibold">New Tab | Companion app</p>
            <p className="text-[11px] text-green-500 font-semibold">{status}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 no-drag"
            onClick={(e) => {
              e.preventDefault();
              setShowNewTab(!showNewTab);
            }}
          >
            NewTab
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 no-drag"
            onClick={() => setShowSettings(true)}
          >
            <Settings2 className="h-4 w-4" />
            Settings
          </Button>
          <div className={`${os == "macOS" ? 'hidden' : 'flex'} items-center gap-1 no-drag`}>
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0"
              title="Minimize"
              onClick={() => api?.windowMinimize?.()}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0"
              title="Maximize"
              onClick={() => api?.windowMaximize?.()}
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-9 p-0 text-rose-300"
              title="Close"
              onClick={() => api?.windowClose?.()}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="w-full h-px bg-slate-800"></div>

      <section className="p-4">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="h-fit rounded-md border border-slate-800 bg-slate-900/60 p-4 backdrop-blur shadow-xl">
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="w-full max-w-[260px] overflow-hidden rounded border border-slate-800 bg-slate-900 shadow-inner">
                <img
                  src={nowPlaying?.artworkUrl || fallbackArtwork}
                  alt={nowPlaying?.title || "Artwork"}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                    {nowPlaying?.source || "none"}
                  </p>
                  <h1 className="text-3xl font-semibold leading-tight">
                    {nowPlaying?.title || "Nothing playing"}
                  </h1>
                  <p className="text-lg text-slate-300">
                    {nowPlaying?.artist || "—"}
                  </p>
                  <p className="text-sm text-slate-400">
                    {nowPlaying?.album || ""}
                  </p>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                {!spotifyConnected ? (
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={handleSpotifyConnect}
                  >
                    <Wifi className="h-4 w-4" />
                    Connect Spotify
                  </Button>
                ) : nowPlaying?.source === "spotify" ? (
                  <div className="flex flex-col items-start gap-2 text-sm text-emerald-300">
                    <span className="inline-flex items-center gap-2 rounded bg-emerald-500/15 px-3 py-1 text-xs font-semibold whitespace-nowrap">
                      <Wifi className="h-3 w-3" />
                      Spotify linked
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSettings(true)}
                    >
                      Manage in Settings
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-slate-800 bg-slate-900/60 p-4 backdrop-blur shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                  Status
                </p>
                <p className="text-lg font-semibold">Live feed</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded bg-emerald-500/15 p-2 px-3 text-xs font-semibold text-emerald-300 uppercase">
                <Wifi className="h-3 w-3" />
                {nowPlaying?.source || "none"}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {["spotify", "cider"].map((svc) => {
                const active = nowPlaying?.source === svc;
                const enabled =
                  svc === "spotify" ? settings?.preferSpotify : settings?.preferCider;
                const lastTrack = serviceTracks[svc];
                const statusLabel = active
                  ? "Active"
                  : enabled
                    ? "Enabled"
                    : "Disabled";
                const statusClass = active
                  ? "bg-emerald-500/15 text-emerald-300"
                  : enabled
                    ? "bg-slate-800 text-slate-200"
                    : "bg-slate-800 text-slate-500";
                return (
                  <div
                    key={svc}
                    className="rounded border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-slate-400">
                        <Music className="h-3.5 w-3.5" />
                        {svc === "spotify" ? "Spotify" : "Cider"}
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-slate-300">
                      <p className="text-sm font-semibold">
                        {active
                          ? nowPlaying?.title || "—"
                          : lastTrack?.title || (enabled ? "Idle" : "Off")}
                      </p>
                      <p className="text-xs text-slate-400">
                        {active
                          ? nowPlaying?.artist || "—"
                          : lastTrack?.artist || "—"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {showSettings && settings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm no-drag">
          <div className="w-[520px] max-w-full rounded-md border border-slate-800 bg-slate-900 p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                  Overlay
                </p>
                <p className="text-lg font-semibold">Settings</p>
              </div>
              <div className="flex items-center gap-3">
                {appVersion && (
                  <span className="text-xs text-slate-400">v{appVersion}</span>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowSettings(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-md border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span>Spotify</span>
                  <div className="flex gap-2">
                    {!spotifyConnected ? (
                      <Button size="sm" variant="outline" onClick={handleSpotifyConnect}>
                        Connect
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={handleSpotifyConnect}>
                          Reconnect
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-rose-300"
                          onClick={handleSpotifyDisconnect}
                        >
                          Disconnect
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs opacity-50">Only selected people have access right now — sorry about that.</p>
              </div>
              <div className="w-full h-px bg-slate-800"></div>
              <div className="flex items-center justify-between gap-3">
                <span>Prefer Spotify</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleSetting("preferSpotify")}
                >
                  {settings.preferSpotify ? "On" : "Off"}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <p>Prefer Cider</p>
                  <span className="text-xs opacity-50">Should be detected automatically when cider is open</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleSetting("preferCider")}
                >
                  {settings.preferCider ? "On" : "Off"}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Autostart</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleSetting("autostart")}
                >
                  {settings.autostart ? "On" : "Off"}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span>Updates</span>
                  <span className="text-xs text-slate-400">{updateStatus}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setUpdateStatus("Checking for updates...");
                    api
                      ?.checkForUpdates?.()
                      .then((res) => {
                        if (!res?.ok) {
                          setUpdateStatus(res?.message || "Update check failed");
                        } else if (res?.info?.version) {
                          setUpdateStatus(`Latest: v${res.info.version}`);
                        } else {
                          setUpdateStatus("Up to date");
                        }
                      })
                      .catch(() => setUpdateStatus("Update check failed"));
                  }}
                >
                  Check for Updates
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
