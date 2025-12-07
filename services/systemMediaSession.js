import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
let warned = false;
const debug = (...args) => {
  if (process.env.SYSTEM_MEDIA_DEBUG === "1") {
    console.log("[system-media]", ...args);
  }
};

// Fallback for macOS: ask Music/Spotify via AppleScript (best effort only).
async function fetchFromMacMedia() {
  if (process.platform !== "darwin") return null;

  const script = `
set sep to "||"
set candidates to {"Music", "Spotify"}

repeat with appName in candidates
  set appExists to false
  try
    if application appName is running then set appExists to true
  end try
  if appExists then
    try
      tell application appName
        if (exists current track) and player state is playing then
          set t to name of current track
          set ar to artist of current track
          set al to album of current track
          set dur to duration of current track
          set posi to player position
          return appName & sep & t & sep & ar & sep & al & sep & posi & sep & dur
        end if
      end tell
    end try
  end if
end repeat
return ""
`.trim();

  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script], {
      timeout: 2000
    });
    const line = (stdout || "").trim();
    if (!line) return null;
    const parts = line.split("||");
    if (parts.length < 6) return null;
    const [, title, artist, album, pos, dur] = parts;
    const progressMs = Math.max(0, Math.round(Number(pos) * 1000) || 0);
    const durationMs = Math.max(0, Math.round(Number(dur) * 1000) || 0);
    return {
      title: title || "",
      artist: artist || "",
      album: album || "",
      artworkUrl: "",
      progressMs,
      durationMs,
      isPlaying: true,
      source: "system"
    };
  } catch (err) {
    debug("mac media fetch failed", err?.message || err);
    return null;
  }
}

function unwrapVariant(value) {
  return value && typeof value === "object" && "value" in value ? value.value : value;
}

async function fetchFromLinuxMpris() {
  if (process.platform !== "linux") return null;
  let sessionBus;
  try {
    ({ sessionBus } = await import("dbus-next"));
  } catch (err) {
    if (!warned) {
      console.warn("[system-media] dbus-next missing; install dependency", err?.message || err);
      warned = true;
    }
    return null;
  }

  const bus = sessionBus();
  let names;
  try {
    names = await bus.listNames();
  } catch (err) {
    debug("dbus list names failed", err?.message || err);
    return null;
  }

  const players = names.filter((n) => n.startsWith("org.mpris.MediaPlayer2."));
  if (!players.length) return null;

  async function readPlayer(name) {
    try {
      const obj = await bus.getProxyObject(name, "/org/mpris/MediaPlayer2");
      const props = obj.getInterface("org.freedesktop.DBus.Properties");
      const statusVar = await props.Get("org.mpris.MediaPlayer2.Player", "PlaybackStatus");
      const metaVar = await props.Get("org.mpris.MediaPlayer2.Player", "Metadata");
      const positionVar = await props.Get("org.mpris.MediaPlayer2.Player", "Position");
      const status = String(unwrapVariant(statusVar) || "").toLowerCase();
      const meta = unwrapVariant(metaVar) || {};

      const getMeta = (key) => unwrapVariant(meta[key]) || "";
      const title = getMeta("xesam:title") || "";
      const artistArr = getMeta("xesam:artist");
      const artist = Array.isArray(artistArr) ? artistArr.join(", ") : artistArr || "";
      const album = getMeta("xesam:album") || "";
      const artUrl = getMeta("mpris:artUrl") || "";
      const length = Number(getMeta("mpris:length")) || 0; // nanoseconds
      const durationMs = Math.max(0, Math.round(length / 1_000_000));
      const positionNs = Number(unwrapVariant(positionVar)) || 0;
      const progressMs = Math.max(0, Math.round(positionNs / 1_000_000));

      return {
        ok: true,
        status,
        nowPlaying: {
          title,
          artist,
          album,
          artworkUrl: artUrl,
          progressMs,
          durationMs,
          isPlaying: status === "playing",
          source: "system"
        }
      };
    } catch (err) {
      debug(`mpris read failed for ${name}`, err?.message || err);
      return { ok: false };
    }
  }

  for (const name of players) {
    const res = await readPlayer(name);
    if (res.ok && res.status === "playing") return res.nowPlaying;
  }
  for (const name of players) {
    const res = await readPlayer(name);
    if (res.ok) return res.nowPlaying;
  }
  return null;
}

async function fetchFromWindowsSession() {
  if (process.platform !== "win32") return null;

  const script = `
function ConvertTo-Task {
  param(
    [Parameter(Mandatory=$true)]$AsyncOp,
    [Parameter(Mandatory=$true)][Type]$ResultType
  )
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
      $_.Name -eq 'AsTask' -and
      $_.IsGenericMethodDefinition -and
      $_.GetParameters().Length -ge 1 -and
      $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*'
    } |
    Select-Object -First 1
  if (-not $method) { return $null }
  $taskMethod = $method.MakeGenericMethod(@($ResultType))
  return $taskMethod.Invoke($null, @($AsyncOp))
}

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.IRandomAccessStreamWithContentType,Windows.Storage.Streams,ContentType=WindowsRuntime] | Out-Null

$mgrOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
$mgrTask = ConvertTo-Task -AsyncOp $mgrOp -ResultType ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
if (-not $mgrTask) { return }
$mgr = $mgrTask.Result
if ($null -eq $mgr) { return }
$session = $mgr.GetCurrentSession()
if ($null -eq $session) { return }
$propsOp = $session.TryGetMediaPropertiesAsync()
$propsTask = ConvertTo-Task -AsyncOp $propsOp -ResultType ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
if (-not $propsTask) { return }
$props = $propsTask.Result
$timeline = $session.GetPlaybackInfo().TimelineProperties
$status = $session.GetPlaybackInfo().PlaybackStatus
$position = if ($timeline.Position) { [math]::Round($timeline.Position.TotalMilliseconds) } else { 0 }
$duration = if ($timeline.EndTime) { [math]::Round($timeline.EndTime.TotalMilliseconds) } else { 0 }
$artPath = ""
$thumb = $props.Thumbnail
if ($thumb) {
  try {
    $thumbOp = $thumb.OpenReadAsync()
    $thumbTask = ConvertTo-Task -AsyncOp $thumbOp -ResultType ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    if ($thumbTask) {
      $stream = $thumbTask.Result
      if ($stream) {
        $stream.Seek(0) | Out-Null
        $buffer = New-Object byte[] $stream.Size
        $read = $stream.Read($buffer, 0, $buffer.Length)
        if ($read -gt 0) {
          $tempPath = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "newtab-media-art.jpg")
          $file = [System.IO.File]::Open($tempPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::Read)
          $file.Write($buffer, 0, $read)
          $file.Close()
          $artPath = $tempPath
        }
        $stream.Dispose()
      }
    }
  } catch {
    # ignore artwork failures
  }
}
[pscustomobject]@{
  Title = $props.Title
  Artist = $props.Artist
  Album = $props.AlbumTitle
  PlaybackStatus = $status.ToString()
  Position = $position
  Duration = $duration
  ArtworkPath = $artPath
} | ConvertTo-Json -Compress
`.trim();

  try {
    const { stdout } = await execFileAsync("powershell", [
      "-NoProfile",
      "-Command",
      script
    ], {
      timeout: 4000,
      windowsHide: true,
      maxBuffer: 512000
    });
    const output = stdout?.trim();
    if (!output) return null;
    const data = JSON.parse(output);
    if (!data?.Title && !data?.Artist) return null;
    let artworkUrl = "";
    if (data.ArtworkPath) {
      const normalized = String(data.ArtworkPath).replace(/\\\\/g, "/").replace(/\\/g, "/");
      artworkUrl = normalized.startsWith("file://") ? normalized : `file://${normalized}`;
    }
    return {
      title: data.Title || "",
      artist: data.Artist || "",
      album: data.Album || "",
      artworkUrl,
      progressMs: Number(data.Position) || 0,
      durationMs: Number(data.Duration) || 0,
      isPlaying: String(data.PlaybackStatus || "").toLowerCase() === "playing",
      source: "system"
    };
  } catch (err) {
    if (!warned) {
      console.warn("[system-media] fetch failed", err?.message || err);
      warned = true;
    }
    debug("fetch failed", err?.message || err);
    return null;
  }
}

export function createSystemMediaSessionService() {
  let cached = null;

  return {
    id: "system",
    async isAvailable() {
      if (process.platform === "win32") {
        try {
          cached = await fetchFromWindowsSession();
          return !!cached;
        } catch (err) {
          debug("availability check failed", err?.message || err);
          return false;
        }
      }
      if (process.platform === "linux") {
        try {
          cached = await fetchFromLinuxMpris();
          return !!cached;
        } catch (err) {
          debug("availability check failed", err?.message || err);
          return false;
        }
      }
      if (process.platform === "darwin") {
        try {
          cached = await fetchFromMacMedia();
          return !!cached;
        } catch (err) {
          debug("availability check failed", err?.message || err);
          return false;
        }
      }
      return false;
    },
    async getNowPlaying() {
      if (cached) {
        const np = cached;
        cached = null;
        return np;
      }
      if (process.platform === "win32") {
        return fetchFromWindowsSession();
      }
      if (process.platform === "linux") {
        return fetchFromLinuxMpris();
      }
      if (process.platform === "darwin") {
        return fetchFromMacMedia();
      }
      return null;
    }
  };
}
