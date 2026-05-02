import { X } from "lucide-react";
import type { Settings } from "../types/electron";

type Props = {
    onClose: () => void;
    settings: Settings;
    appVersion: string | null;
    spotifyConnected: boolean;
    updatePhase: string;
    updateStatus: string | null;
    onToggleSetting: (key: keyof Settings) => void;
    onUpdateSetting: (key: keyof Settings, value: string) => void;
    onSpotifyConnect: () => void;
    onSpotifyDisconnect: () => void;
    onCheckForUpdates: () => void;
    onDownloadUpdate: () => void;
    onInstallUpdate: () => void;
};

function Row({ label, sub, children }: { label: string; sub?: string; children?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
                <p className="text-sm text-slate-300">{label}</p>
                {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
            </div>
            {children && <div className="shrink-0">{children}</div>}
        </div>
    );
}

function TextAction({ label, onClick, danger, disabled }: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`text-xs transition-colors disabled:opacity-30 disabled:cursor-default ${danger ? "text-slate-500 hover:text-rose-400" : "text-slate-500 hover:text-slate-200"}`}
        >
            {label}
        </button>
    );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
        <button
            onClick={onToggle}
            className={`relative h-5 w-9 rounded-full transition-colors duration-200 focus:outline-none ${on ? "bg-sky-500" : "bg-slate-700"}`}
        >
            <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-4" : "translate-x-0"}`} />
        </button>
    );
}

function Divider() {
    return <div className="h-px bg-slate-800/60" />;
}

export default function SettingsPanel({
    onClose, settings, appVersion, spotifyConnected,
    updatePhase, updateStatus,
    onToggleSetting, onUpdateSetting, onSpotifyConnect, onSpotifyDisconnect,
    onCheckForUpdates, onDownloadUpdate, onInstallUpdate,
}: Props) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm no-drag" onClick={onClose}>
            <div className="w-88 rounded-lg border border-slate-800/60 bg-slate-950 shadow-2xl" onClick={(e) => e.stopPropagation()}>

                {/* Header — matches App.tsx header style */}
                <div className="flex items-center justify-between px-4 py-3 select-none">
                    <span className="text-xs text-slate-500 font-medium">Settings</span>
                    <div className="flex items-center gap-3">
                        {appVersion && <span className="text-xs text-slate-600">v{appVersion}</span>}
                        <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>

                <Divider />

                <div className="px-4 py-1">

                    {/* Music */}
                    <p className="text-[10px] uppercase tracking-widest text-slate-600 mt-3 mb-0.5">Music</p>
                    <Row label="Spotify" sub={spotifyConnected ? "Connected" : "Not connected"}>
                        <div className="flex gap-3">
                            {!spotifyConnected ? (
                                <TextAction label="Connect →" onClick={onSpotifyConnect} />
                            ) : (
                                <>
                                    <TextAction label="Reconnect" onClick={onSpotifyConnect} />
                                    <TextAction label="Disconnect" onClick={onSpotifyDisconnect} danger />
                                </>
                            )}
                        </div>
                    </Row>
                    <Row label="Prefer Spotify">
                        <Toggle on={settings.preferSpotify} onToggle={() => onToggleSetting("preferSpotify")} />
                    </Row>
                    <Row label="Prefer Cider" sub="Detected automatically when Cider is open">
                        <Toggle on={settings.preferCider} onToggle={() => onToggleSetting("preferCider")} />
                    </Row>
                    <Row label="Cider app token" sub="Required by Cider 2.x — find it in Cider → Settings → Extensions & APIs">
                        <input
                            type="password"
                            value={settings.ciderToken ?? ""}
                            onChange={(e) => onUpdateSetting("ciderToken", e.target.value)}
                            placeholder="paste token"
                            className="w-32 rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-slate-500"
                        />
                    </Row>

                    <Divider />

                    {/* App */}
                    <p className="text-[10px] uppercase tracking-widest text-slate-600 mt-3 mb-0.5">App</p>
                    <Row label="Autostart">
                        <Toggle on={settings.autostart} onToggle={() => onToggleSetting("autostart")} />
                    </Row>
                    <Row label="Lyrics">
                        <Toggle on={settings.showLyrics} onToggle={() => onToggleSetting("showLyrics")} />
                    </Row>

                    <Divider />

                    {/* Updates */}
                    <p className="text-[10px] uppercase tracking-widest text-slate-600 mt-3 mb-0.5">Updates</p>
                    <Row label="Software update" sub={updateStatus ?? undefined}>
                        {updatePhase === "downloaded" ? (
                            <TextAction label="Restart →" onClick={onInstallUpdate} />
                        ) : updatePhase === "available" ? (
                            <TextAction label="Download →" onClick={onDownloadUpdate} />
                        ) : (
                            <TextAction
                                label={updatePhase === "checking" ? "Checking…" : "Check"}
                                onClick={onCheckForUpdates}
                                disabled={updatePhase === "checking" || updatePhase === "downloading"}
                            />
                        )}
                    </Row>

                    <div className="pb-2" />
                </div>
            </div>
        </div>
    );
}
