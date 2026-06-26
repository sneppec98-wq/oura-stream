import type { FirestoreFilm, FirestoreEpisode } from "../firestore";
import { getFirstPlayableEpisode, formatFilmType } from "../firestore";
import { getWatchProgress, saveWatchProgress } from "./watch";
import { appState, isSuperAdmin } from "./state";
import { showToast } from "./dialogs";
import { renderPlayerSidebar } from "./ui/PlayerSidebar";
import { bindPlayerShortcuts } from "./ui/PlayerShortcuts";

let videoEl: HTMLVideoElement;
let isDraggingTimeline = false;

export function initPlayer() {
  videoEl = document.getElementById("native-video") as HTMLVideoElement;

  videoEl.addEventListener("timeupdate", updateTimeline);
  videoEl.addEventListener("loadedmetadata", () => {
    document.getElementById("duration-time")!.textContent = formatTime(videoEl.duration);
    showLoader(false);
  });
  videoEl.addEventListener("waiting", () => showLoader(true));
  videoEl.addEventListener("canplay", () => showLoader(false));
  videoEl.addEventListener("play", () => setPlayState(true));
  videoEl.addEventListener("pause", () => setPlayState(false));
  videoEl.addEventListener("ended", onVideoEnded);

  document.getElementById("btn-play-pause")!.addEventListener("click", togglePlay);
  videoEl.addEventListener("click", togglePlay);

  document.getElementById("btn-skip-back")!.addEventListener("click", () => { videoEl.currentTime -= 10; });
  document.getElementById("btn-skip-forward")!.addEventListener("click", () => { videoEl.currentTime += 10; });

  const timelineBar = document.getElementById("timeline-bar")!;
  timelineBar.addEventListener("click", (e) => {
    const rect = timelineBar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (videoEl.duration) videoEl.currentTime = ratio * videoEl.duration;
  });
  timelineBar.addEventListener("mousedown", (e) => {
    isDraggingTimeline = true;
    seekFromEvent(e, timelineBar);
  });
  window.addEventListener("mousemove", (e) => { if (isDraggingTimeline) seekFromEvent(e, timelineBar); });
  window.addEventListener("mouseup", () => { isDraggingTimeline = false; });

  const volSlider = document.getElementById("volume-slider") as HTMLInputElement;
  volSlider.addEventListener("input", () => {
    videoEl.volume = parseFloat(volSlider.value);
    updateVolumeIcons(videoEl.volume);
  });
  document.getElementById("btn-mute")!.addEventListener("click", () => {
    videoEl.muted = !videoEl.muted;
    updateVolumeIcons(videoEl.muted ? 0 : videoEl.volume);
  });

  document.getElementById("btn-fullscreen")!.addEventListener("click", () => {
    const container = document.querySelector<HTMLDivElement>(".player-container")!;
    if (!document.fullscreenElement) container.requestFullscreen();
    else document.exitFullscreen();
  });

  document.getElementById("btn-close-player")!.addEventListener("click", closePlayer);

  document.getElementById("btn-prev-episode")?.addEventListener("click", () => {
    if (appState.currentPlayingEp && appState.currentPlayingFilm) {
      const isSecretMatcha = appState.currentPlayingFilm.type === "matcha" && (appState.currentPlayingFilm as any).matchaCategory === "secret";
      if (isSecretMatcha) {
        const idx = appState.currentLibraryItems.findIndex(f => f.id === appState.currentPlayingFilm!.id);
        if (idx > 0) {
          const prevFilm = appState.currentLibraryItems[idx - 1];
          const prevEp = getFirstPlayableEpisode(prevFilm);
          if (prevEp) {
            playEpisode(prevEp, prevFilm);
          }
        }
      } else {
        const eps = appState.currentPlayingFilm.episodes || [];
        const idx = eps.findIndex(e => e.id === appState.currentPlayingEp!.id);
        if (idx > 0) {
          playEpisode(eps[idx - 1], appState.currentPlayingFilm);
        }
      }
    }
  });

  document.getElementById("btn-next-episode")?.addEventListener("click", () => {
    if (appState.currentPlayingEp && appState.currentPlayingFilm) {
      const isSecretMatcha = appState.currentPlayingFilm.type === "matcha" && (appState.currentPlayingFilm as any).matchaCategory === "secret";
      if (isSecretMatcha) {
        const idx = appState.currentLibraryItems.findIndex(f => f.id === appState.currentPlayingFilm!.id);
        if (idx >= 0 && idx + 1 < appState.currentLibraryItems.length) {
          const nextFilm = appState.currentLibraryItems[idx + 1];
          const nextEp = getFirstPlayableEpisode(nextFilm);
          if (nextEp) {
            playEpisode(nextEp, nextFilm);
          }
        }
      } else {
        const eps = appState.currentPlayingFilm.episodes || [];
        const idx = eps.findIndex(e => e.id === appState.currentPlayingEp!.id);
        if (idx >= 0 && idx + 1 < eps.length) {
          playEpisode(eps[idx + 1], appState.currentPlayingFilm);
        }
      }
    }
  });

  document.getElementById("btn-toggle-source")?.addEventListener("click", () => {
    const box = document.getElementById("player-source-box");
    const btn = document.getElementById("btn-toggle-source");
    if (box && btn) {
      const isHidden = box.style.display === "none";
      box.style.display = isHidden ? "block" : "none";
      btn.querySelector("span")!.textContent = isHidden ? "🙈 Sembunyikan Sumber Video" : "👁 Lihat Sumber Video";
    }
  });

  document.getElementById("btn-toggle-sidebar")?.addEventListener("click", () => {
    const sidebarEl = document.getElementById("player-sidebar");
    const toggleSidebarBtn = document.getElementById("btn-toggle-sidebar");
    if (sidebarEl && toggleSidebarBtn) {
      appState.isPlayerSidebarCollapsed = !appState.isPlayerSidebarCollapsed;
      sidebarEl.style.display = appState.isPlayerSidebarCollapsed ? "none" : "flex";
      const textSpan = toggleSidebarBtn.querySelector("span");
      if (textSpan) {
        textSpan.textContent = appState.isPlayerSidebarCollapsed ? "Tampilkan Episode" : "Sembunyikan Episode";
      }
    }
  });

  bindPlayerShortcuts(videoEl, closePlayer, togglePlay);
}

function onVideoEnded() {
  setPlayState(false);
  if (appState.currentPlayingEp && appState.currentPlayingFilm) {
    saveWatchProgress(appState.currentPlayingFilm.id, appState.currentPlayingEp.id, {
      filmId: appState.currentPlayingFilm.id,
      episodeId: appState.currentPlayingEp.id,
      currentTime: 0,
      duration: 0,
      timestamp: Date.now(),
    });
    const isSecretMatcha = appState.currentPlayingFilm.type === "matcha" && (appState.currentPlayingFilm as any).matchaCategory === "secret";
    if (isSecretMatcha) {
      const idx = appState.currentLibraryItems.findIndex(f => f.id === appState.currentPlayingFilm!.id);
      if (idx >= 0 && idx + 1 < appState.currentLibraryItems.length) {
        const nextFilm = appState.currentLibraryItems[idx + 1];
        const nextEp = getFirstPlayableEpisode(nextFilm);
        if (nextEp) {
          showToast(`Memutar video berikutnya: ${nextFilm.title}`, "info");
          setTimeout(() => playEpisode(nextEp, nextFilm), 2000);
        }
      }
    } else {
      const eps = appState.currentPlayingFilm.episodes || [];
      const currentIdx = eps.findIndex(e => e.id === appState.currentPlayingEp!.id);
      if (currentIdx >= 0 && currentIdx + 1 < eps.length) {
        const nextEp = eps[currentIdx + 1];
        showToast(`Memutar episode berikutnya: ${nextEp.title}`, "info");
        setTimeout(() => playEpisode(nextEp, appState.currentPlayingFilm!), 2000);
      }
    }
  }
}

function seekFromEvent(e: MouseEvent, bar: HTMLElement) {
  const rect = bar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  if (videoEl.duration) videoEl.currentTime = ratio * videoEl.duration;
}

function setPlayState(playing: boolean) {
  const container = document.querySelector(".player-container")!;
  document.getElementById("play-icon")!.style.display = playing ? "none" : "block";
  document.getElementById("pause-icon")!.style.display = playing ? "block" : "none";
  if (playing) container.classList.remove("paused");
  else container.classList.add("paused");
}

function showLoader(show: boolean) {
  document.getElementById("player-loader")!.style.display = show ? "flex" : "none";
}

function updateTimeline() {
  if (!videoEl.duration) return;
  const pct = (videoEl.currentTime / videoEl.duration) * 100;
  document.getElementById("timeline-progress")!.style.width = `${pct}%`;
  document.getElementById("timeline-handle")!.style.left = `${pct}%`;
  document.getElementById("current-time")!.textContent = formatTime(videoEl.currentTime);

  if (appState.currentPlayingEp && appState.currentPlayingFilm) {
    const prog = {
      filmId: appState.currentPlayingFilm.id,
      episodeId: appState.currentPlayingEp.id,
      currentTime: videoEl.currentTime,
      duration: videoEl.duration,
      timestamp: Date.now(),
    };
    saveWatchProgress(appState.currentPlayingFilm.id, appState.currentPlayingEp.id, prog);
  }
}

function updateVolumeIcons(volume: number) {
  document.getElementById("vol-high-icon")!.style.display = volume > 0 ? "block" : "none";
  document.getElementById("vol-mute-icon")!.style.display = volume > 0 ? "none" : "block";
}

function togglePlay() {
  if (videoEl.paused) videoEl.play();
  else videoEl.pause();
}


export async function playEpisode(ep: FirestoreEpisode, film: FirestoreFilm) {
  const modal = document.getElementById("player-modal")!;
  const nativeEl = document.getElementById("native-video") as HTMLVideoElement;
  const embedContainer = document.getElementById("embed-container")!;
  const controls = document.getElementById("player-controls")!;

  appState.currentPlayingEp = ep;
  appState.currentPlayingFilm = film;

  renderPlayerSidebar(film, ep, playEpisode);

  const detailsTitle = document.getElementById("player-details-title");
  if (detailsTitle) {
    detailsTitle.textContent = film.type === "film" ? film.title : `${film.title} — ${ep.title}`;
  }
  const detailsType = document.getElementById("player-details-type");
  if (detailsType) {
    detailsType.textContent = formatFilmType(film);
    detailsType.className = `badge ${film.type === 'film' ? 'badge-movie' : 'badge-series'}`;
  }
  const detailsYear = document.getElementById("player-details-year");
  if (detailsYear) {
    detailsYear.textContent = (film.releaseYear && film.releaseYear !== 0 && film.releaseYear !== '0') ? String(film.releaseYear) : "";
  }
  const detailsCountry = document.getElementById("player-details-country");
  if (detailsCountry) {
    detailsCountry.textContent = film.country ? `• ${film.country}` : "";
  }
  const sourceUrl = document.getElementById("player-source-url");
  if (sourceUrl) {
    sourceUrl.textContent = isSuperAdmin() ? ep.videoUrl : "";
  }
  const sourceBox = document.getElementById("player-source-box");
  if (sourceBox) {
    sourceBox.style.display = "none";
  }
  const toggleSourceBtn = document.getElementById("btn-toggle-source");
  if (toggleSourceBtn) {
    if (isSuperAdmin()) {
      toggleSourceBtn.style.display = "inline-flex";
      const span = toggleSourceBtn.querySelector("span");
      if (span) span.textContent = "👁 Lihat Sumber Video";
    } else {
      toggleSourceBtn.style.display = "none";
    }
  }

  const prevBtn = document.getElementById("btn-prev-episode") as HTMLButtonElement;
  const nextBtn = document.getElementById("btn-next-episode") as HTMLButtonElement;
  if (prevBtn && nextBtn) {
    const isSecretMatcha = film.type === "matcha" && (film as any).matchaCategory === "secret";
    if (isSecretMatcha) {
      const filmIdx = appState.currentLibraryItems.findIndex(f => f.id === film.id);
      prevBtn.style.display = filmIdx > 0 ? "inline-flex" : "none";
      nextBtn.style.display = (filmIdx >= 0 && filmIdx + 1 < appState.currentLibraryItems.length) ? "inline-flex" : "none";
    } else if (film.type === "film") {
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
    } else {
      const eps = film.episodes || [];
      const currentIdx = eps.findIndex(e => e.id === ep.id);
      prevBtn.style.display = currentIdx > 0 ? "inline-flex" : "none";
      nextBtn.style.display = (currentIdx >= 0 && currentIdx + 1 < eps.length) ? "inline-flex" : "none";
    }
  }

  nativeEl.style.display = "none";
  embedContainer.style.display = "none";
  embedContainer.innerHTML = "";
  controls.style.display = "flex";
  modal.style.display = "flex";
  showLoader(true);
  const openBrowserBtn = document.getElementById("btn-player-open-browser");
  if (openBrowserBtn) openBrowserBtn.style.display = "none";
  document.getElementById("duration-time")!.textContent = "00:00";
  document.getElementById("current-time")!.textContent = "00:00";

  const rawVideoUrl = (ep.videoUrl || "").trim();
  const storageType = (ep.storage || "").toLowerCase();

  const isIframeHtml = rawVideoUrl.startsWith("<iframe") || rawVideoUrl.includes("iframe");
  const isEmbedDomain = rawVideoUrl.includes("dood") || rawVideoUrl.includes("ds2video") || rawVideoUrl.includes("fembed") || rawVideoUrl.includes("voe") || rawVideoUrl.includes("streamtape") || rawVideoUrl.includes("vidguard") || rawVideoUrl.includes("mixdrop") || rawVideoUrl.includes("drive.google.com");
  const isDirectVideo = !!rawVideoUrl.match(/\.(mp4|mkv|webm|avi|m3u8|mov|3gp|flv)(\?.*)?$/i);
  
  const isExternal = isIframeHtml || isEmbedDomain || (!isDirectVideo && storageType === 'iframe');

  if (isExternal) {
    showLoader(false);
    controls.style.display = "none";
    embedContainer.style.display = "flex";

    let embedUrl = rawVideoUrl;
    if (rawVideoUrl.includes("drive.google.com")) {
      const fileId = extractGDriveFileId(rawVideoUrl);
      if (fileId) {
        embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      }
    } else {
      embedUrl = embedUrl.trim();
      if (embedUrl.toLowerCase().startsWith("<iframe")) {
        const match = embedUrl.match(/src=["']([^"']+)["']/i);
        if (match) embedUrl = match[1];
      }
    }

    if (openBrowserBtn) {
      openBrowserBtn.style.display = "flex";
      openBrowserBtn.onclick = async () => {
        try {
          const { openUrl } = await import("@tauri-apps/plugin-opener");
          await openUrl(embedUrl);
        } catch (err) {
          console.error("Failed to open URL in browser:", err);
          window.open(embedUrl, "_blank");
        }
      };
    }

    const iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.referrerPolicy = "no-referrer";
    iframe.allowFullscreen = true;
    iframe.allow = "autoplay; fullscreen; picture-in-picture";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    embedContainer.appendChild(iframe);
    return;
  }

  nativeEl.style.display = "block";
  try {
    nativeEl.src = rawVideoUrl;
    nativeEl.load();

    const progress = getWatchProgress(film.id, ep.id);
    if (progress && progress.currentTime > 5 && progress.currentTime < progress.duration - 10) {
      nativeEl.currentTime = progress.currentTime;
      showToast(`Melanjutkan dari ${formatTime(progress.currentTime)}`, "info");
    }

    await nativeEl.play();
  } catch (err) {
    showLoader(false);
    showToast(`Gagal memuat video: ${String(err)}`, "error");
    closePlayer();
  }
}

function extractGDriveFileId(url: string): string {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : url;
}

export function closePlayer() {
  const modal = document.getElementById("player-modal")!;
  modal.style.display = "none";
  if (videoEl) {
    videoEl.pause();
    videoEl.src = "";
  }
  const embedContainer = document.getElementById("embed-container")!;
  embedContainer.innerHTML = "";
  setPlayState(false);
  appState.currentPlayingEp = null;
  appState.currentPlayingFilm = null;
  appState.isPlayerSidebarCollapsed = false;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
