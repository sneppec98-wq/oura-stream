import type { FirestoreFilm, FirestoreEpisode } from "../firestore";
import { getSeasons, getEpisodesBySeason, getFirstPlayableEpisode, formatFilmType, loadTrendingFilms, loadRecentlyAdded, fetchFilmsByIds, searchFilmsFirestore, loadFilmsPaginated, deleteFilmFirestore } from "../firestore";
import { getWatchProgress } from "./watch";
import { showToast, showCustomConfirm } from "./dialogs";
import { appState, disableMatchaManageMode, saveAppState, isSuperAdmin } from "./state";
import { playEpisode } from "./player";
import { createMediaCardHTML, createContinueWatchingCardHTML } from "./ui/CardBuilder";
import { renderHeroBanner, initRowScrollButtons } from "./ui/Carousel";
import { renderPaginationControls } from "./ui/Pagination";
import { openDetailModal } from "./ui/Modal";

function setLoadingState(loading: boolean, message = "Memuat koleksi...") {
  const grid = document.getElementById("media-grid")!;
  const emptyState = document.getElementById("empty-library")!;
  const streamingRows = document.getElementById("streaming-rows")!;
  const heroContainer = document.getElementById("hero-banner")!;
  const loadingEl = document.getElementById("library-loading")!;

  if (loading) {
    heroContainer.style.display = "none";
    streamingRows.style.display = "none";
    emptyState.style.display = "none";
    grid.innerHTML = "";
    loadingEl.style.display = "flex";
    const textEl = loadingEl.querySelector<HTMLSpanElement>(".loading-text");
    if (textEl) textEl.textContent = message;
  } else {
    loadingEl.style.display = "none";
    streamingRows.style.display = "block";
  }
}

function getLibraryHeaderTitle(): string {
  if (appState.searchQuery.trim()) {
    return "Hasil Pencarian";
  }

  switch (appState.activeFilter) {
    case "film":
      return "Koleksi Film";
    case "series":
      return "Koleksi Series";
    case "movie_series":
      return "Koleksi Movie Series";
    case "mocha":
      return "Koleksi Mocha 18+";
    case "matcha":
      if (appState.matchaSubFilter === "bl_series") {
        return "Koleksi Matcha - BL Series";
      }
      if (appState.matchaSubFilter === "bl_movie") {
        return "Koleksi Matcha - BL Movie";
      }
      return "Koleksi Matcha - Koleksi";
    default:
      return "Koleksi Semua";
  }
}

function getLibraryActiveLabel(): string {
  switch (appState.activeFilter) {
    case "matcha":
      return "Matcha";
    case "film":
      return "Film";
    case "series":
      return "Series";
    case "movie_series":
      return "Movie Series";
    case "indonesia":
      return "Indonesia";
    case "anime":
      return "Anime";
    case "mocha":
      return "Mocha";
    default:
      return "Koleksi";
  }
}

export function switchView(viewId: "view-library" | "view-settings" | "view-upload" | "view-mylist" | "view-drafts", activeBtnId?: string) {
  // Close submenus when navigating
  document.querySelectorAll(".nav-group.expanded").forEach(g => g.classList.remove("expanded"));
  
  document.querySelectorAll(".app-view").forEach(v => v.classList.remove("active"));
  document.getElementById(viewId)?.classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  
  if (activeBtnId) {
    const btn = document.getElementById(activeBtnId);
    if (btn) {
      btn.classList.add("active");
      const group = btn.closest(".nav-group");
      if (group) {
        const parentBtn = group.querySelector(".has-submenu");
        if (parentBtn) parentBtn.classList.add("active");
      }
    }
  } else {
    const navMap: Record<string, string> = {
      "view-library": "nav-home",
      "view-settings": "nav-settings",
      "view-upload": "nav-downloads",
      "view-mylist": "nav-mylist",
      "view-drafts": "nav-drafts",
    };
    const mappedBtnId = navMap[viewId];
    if (mappedBtnId) {
      const btn = document.getElementById(mappedBtnId);
      if (btn) {
        btn.classList.add("active");
        const group = btn.closest(".nav-group");
        if (group) {
          const parentBtn = group.querySelector(".has-submenu");
          if (parentBtn) parentBtn.classList.add("active");
        }
      }
    }
  }
}
(window as any).switchView = switchView;

async function loadHomeData(force = false) {
  if (!force && appState.homeCache) {
    return appState.homeCache;
  }

  try {
    const trendingFilms = await loadTrendingFilms(10, false);
    const recentlyFilms = await loadRecentlyAdded(5, false);

    const progressKeys = Object.keys(localStorage).filter(k => k.startsWith("oura_progress_"));
    const filmIds = Array.from(new Set(progressKeys.map(k => {
      return k.replace("oura_progress_", "").split("_ep")[0];
    }))).slice(0, 8);
    const continueFilms = await fetchFilmsByIds(filmIds);

    appState.homeCache = {
      featured: recentlyFilms,
      trending: trendingFilms,
      picks: trendingFilms.slice(0, 5),
      added: recentlyFilms,
      continue: continueFilms
    };

    return appState.homeCache;
  } catch (err) {
    console.error("loadHomeData error:", err);
    throw err;
  }
}

export async function renderLibrary(forceRefresh = false) {
  const grid = document.getElementById("media-grid")!;
  const emptyState = document.getElementById("empty-library")!;
  const streamingRows = document.getElementById("streaming-rows")!;
  const heroContainer = document.getElementById("hero-banner")!;
  const rowContinue = document.getElementById("row-continue-watching")!;
  const scrollerContinue = document.getElementById("scroller-continue-watching")!;
  const rowMovies = document.getElementById("row-movies")!;
  const rowSeries = document.getElementById("row-series")!;
  const rowAll = document.getElementById("row-all-media")!;
  const allTitle = document.getElementById("all-media-title")!;

  let isAdmin = false;
  let items: FirestoreFilm[] = [];

  try {
    const isMatcha = appState.activeFilter === "matcha";
    if (isMatcha) {
      grid.classList.add("grid-landscape");
    } else {
      grid.classList.remove("grid-landscape");
    }

    if (appState.activeFilter !== "matcha") {
      disableMatchaManageMode();
    }
    const isSearchingOrFiltering = appState.searchQuery.trim() !== "" || appState.activeFilter !== "all";

    const matchaTabsContainer = document.getElementById("matcha-tabs");
    if (matchaTabsContainer) {
      matchaTabsContainer.style.display = appState.activeFilter === "matcha" ? "flex" : "none";
    }
    const viewTitle = document.querySelector(".view-title") as HTMLElement;
    if (viewTitle) {
      viewTitle.style.display = appState.activeFilter === "matcha" ? "none" : "block";
    }

    const mainPanel = document.querySelector(".library-main-panel");
    if (mainPanel) {
      if (isSearchingOrFiltering) {
        mainPanel.classList.remove("dashboard-mode");
      } else {
        mainPanel.classList.add("dashboard-mode");
      }
    }

    if (isSearchingOrFiltering) {
      emptyState.style.display = "none";
      streamingRows.style.display = "block";
      heroContainer.style.display = "none";
      rowContinue.style.display = "none";
      rowMovies.style.display = "none";
      rowSeries.style.display = "none";
      rowAll.style.display = "block";
      allTitle.textContent = getLibraryHeaderTitle();

      setLoadingState(true, "Memuat halaman...");

      items = [];
      if (appState.searchQuery.trim() !== "") {
        const pagControls = document.getElementById("pagination-controls");
        if (pagControls) pagControls.style.display = "none";
        
        items = await searchFilmsFirestore(appState.searchQuery, appState.gridItemsPerPage, isAdmin, appState.activeFilter);
      } else {
        const pagControls = document.getElementById("pagination-controls");
        if (pagControls) pagControls.style.display = "flex";

        const cursor = appState.gridCurrentPage > 1 ? appState.gridPageCursors[appState.gridCurrentPage - 2] : null;
        const res = await loadFilmsPaginated(appState.activeFilter, appState.gridItemsPerPage, cursor, isAdmin, appState.activeFilter === "matcha" ? appState.matchaSubFilter : undefined);
        items = res.films;
        appState.gridLastVisibleDoc = res.lastVisible;
        
        renderPaginationControls(items.length, res.totalCount);
      }

      setLoadingState(false);
      appState.currentLibraryItems = items;

      if (items.length === 0) {
        const activeLabel = getLibraryActiveLabel();
        grid.innerHTML = `
          <div style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; color: var(--text-secondary);">
            <div style="font-size: 48px; margin-bottom: 16px;">🍵</div>
            <h3 style="font-size: 18px; font-weight: 600; color: #fff; margin-bottom: 8px;">Koleksi ${activeLabel} Kosong</h3>
            <p style="font-size: 13px; color: var(--text-muted); max-width: 320px; margin: 0 auto;">Belum ada konten untuk kategori ini di database.</p>
          </div>`;
      } else {
        grid.innerHTML = items.map(f => createMediaCardHTML(f)).join("");
      }

      const btnSelectAll = document.getElementById("btn-matcha-select-all");
      if (btnSelectAll) {
        const checkboxes = document.querySelectorAll<HTMLInputElement>(".matcha-card-checkbox");
        if (checkboxes.length > 0) {
          const allChecked = Array.from(checkboxes).every(chk => chk.checked);
          btnSelectAll.textContent = allChecked ? "Batal Semua" : "Pilih Semua";
        } else {
          btnSelectAll.textContent = "Pilih Semua";
        }
      }
      const btnDeleteSelected = document.getElementById("btn-matcha-delete-selected") as HTMLButtonElement | null;
      if (btnDeleteSelected) {
        btnDeleteSelected.textContent = `Hapus Terpilih (${appState.selectedMatchaIds.length})`;
        const isManageMode = grid.classList.contains("manage-mode");
        btnDeleteSelected.style.display = (isManageMode && appState.selectedMatchaIds.length > 0) ? "block" : "none";
      }
    } else {
      const pagControls = document.getElementById("pagination-controls");
      if (pagControls) pagControls.style.display = "none";

      setLoadingState(true, "Memuat rekomendasi...");
      try {
        const data = await loadHomeData(forceRefresh);
        setLoadingState(false);

        if (!data.featured || data.featured.length === 0 && data.trending.length === 0 && data.continue.length === 0) {
          heroContainer.style.display = "none";
          streamingRows.style.display = "none";
          emptyState.style.display = "flex";
          return;
        }

        emptyState.style.display = "none";
        streamingRows.style.display = "block";

        if (data.featured && data.featured.length > 0) {
          renderHeroBanner(data.featured, quickPlay);
        } else {
          heroContainer.style.display = "none";
        }

        if (data.continue.length > 0) {
          rowContinue.style.display = "block";
          scrollerContinue.innerHTML = data.continue.map(f => {
            const progress = getWatchProgress(f.id, f.episodes?.[0]?.id || "0");
            const fallbackProg = progress || { filmId: f.id, episodeId: "0", currentTime: 0, duration: 100, timestamp: 0 };
            return createContinueWatchingCardHTML(f, fallbackProg);
          }).join("");
          scrollerContinue.scrollLeft = 0;
        } else {
          rowContinue.style.display = "none";
        }

        rowMovies.style.display = "none";
        rowSeries.style.display = "none";
        rowAll.style.display = "none";
      } catch (err) {
        setLoadingState(false);
        emptyState.style.display = "flex";
      }
    }
  } catch (err: any) {
    console.error("Error in renderLibrary:", err);
    setLoadingState(false);
    if (err.message === "FIRESTORE_PERMISSION_DENIED_MATCHA") {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; text-align: center; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; margin: 20px 0;">
          <span style="font-size: 40px; margin-bottom: 12px;">🔒</span>
          <h3 style="font-size: 18px; font-weight: 700; color: #fca5a5; margin-bottom: 8px;">Pembaruan Aturan Firebase Diperlukan</h3>
          <p style="font-size: 13.5px; color: var(--text-secondary); max-width: 480px; margin: 0 auto 16px; line-height: 1.5;">
            Koleksi baru <strong>\"matcha\"</strong> belum dapat diakses karena aturan keamanan Firebase (Security Rules) Anda memblokirnya. Silakan buka Firebase Console Anda dan tambahkan aturan berikut:
          </p>
          <div style="background: #111; border: 1px solid #333; border-radius: 8px; padding: 16px; width: 100%; max-width: 480px; text-align: left; margin-bottom: 16px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.5);">
            <pre style="margin: 0; font-family: monospace; font-size: 12px; color: #a4db5c; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">match /matcha/{document} {
  allow read: if true;
  allow write: if request.auth != null;
}</pre>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin: 0;">
            Setelah Aturan ditambahkan dan dipublikasikan di Firebase Console, silakan klik tombol Segarkan (Refresh) di atas.
          </p>
        </div>`;
      showToast("Gagal mengakses database Matcha: Perlu update aturan Firebase", "error");
    } else {
      showToast(`Error memuat library: ${err.message || String(err)}`, "error");
    }
  }

  document.querySelectorAll<HTMLDivElement>(".media-card, .continue-card").forEach(card => {
    const video = card.querySelector<HTMLVideoElement>(".card-video-preview");
    if (video) {
      card.addEventListener("mouseenter", () => {
        video.play().catch(err => {
          console.debug("Video preview play failed/interrupted:", err);
        });
      });
      card.addEventListener("mouseleave", () => {
        video.pause();
        video.currentTime = 0;
      });
    }

    card.addEventListener("click", async (e) => {
      const grid = document.getElementById("media-grid");
      const isManageMode = grid?.classList.contains("manage-mode");
      
      if (isManageMode && card.classList.contains("media-card")) {
        const chk = card.querySelector(".matcha-card-checkbox") as HTMLInputElement | null;
        if (chk) {
          chk.checked = !chk.checked;
          chk.dispatchEvent(new Event("change"));
        }
        return;
      }
      
      const target = e.target as HTMLElement;
      const playBtn = target.closest(".card-play-btn, .card-play-btn-circle") as HTMLElement | null;

      const id = card.dataset.id!;
      let film: FirestoreFilm | null = null;
      
      if (items && items.length > 0) {
        film = items.find(f => f.id === id) || null;
      }
      
      if (!film && appState.homeCache) {
        film = appState.homeCache.trending.find(f => f.id === id) || 
               appState.homeCache.continue.find(f => f.id === id) ||
               appState.homeCache.picks.find(f => f.id === id) ||
               appState.homeCache.added.find(f => f.id === id) ||
               null;
      }

      if (!film) {
        try {
          const fetched = await fetchFilmsByIds([id]);
          if (fetched && fetched.length > 0) {
            film = fetched[0];
          }
        } catch (err) {
          console.error("Failed to fetch film on click:", err);
        }
      }

      if (film) {
        if (playBtn || card.classList.contains("continue-card")) {
          quickPlay(film);
        } else {
          openDetailModal(film);
        }
      }
    });
  });

  document.querySelectorAll(".matcha-card-checkbox").forEach(chk => {
    chk.addEventListener("change", (e) => {
      e.stopPropagation();
      const id = chk.getAttribute("data-id")!;
      const isChecked = (chk as HTMLInputElement).checked;
      
      if (isChecked) {
        if (!appState.selectedMatchaIds.includes(id)) appState.selectedMatchaIds.push(id);
      } else {
        appState.selectedMatchaIds = appState.selectedMatchaIds.filter(x => x !== id);
      }
      
      const btnDeleteSelected = document.getElementById("btn-matcha-delete-selected") as HTMLButtonElement | null;
      if (btnDeleteSelected) {
        btnDeleteSelected.textContent = `Hapus Terpilih (${appState.selectedMatchaIds.length})`;
        btnDeleteSelected.style.display = appState.selectedMatchaIds.length > 0 ? "block" : "none";
      }
    });
    
    chk.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  });

  initRowScrollButtons();
}

export function quickPlay(film: FirestoreFilm) {
  const filmProgress = getFilmProgress(film);
  if (filmProgress) {
    playEpisode(filmProgress.ep, film);
    return;
  }
  const firstEp = getFirstPlayableEpisode(film);
  if (firstEp) playEpisode(firstEp, film);
  else openDetailModal(film);
}

function getFilmProgress(film: FirestoreFilm): { ep: FirestoreEpisode; progress: NonNullable<ReturnType<typeof getWatchProgress>> } | null {
  let latest: { ep: FirestoreEpisode; progress: NonNullable<ReturnType<typeof getWatchProgress>> } | null = null;
  const eps = film.episodes || [];
  for (const ep of eps) {
    const prog = getWatchProgress(film.id, ep.id);
    if (!prog) continue;
    if (!latest) {
      latest = { ep, progress: prog };
    } else if (prog.timestamp > latest.progress.timestamp) {
      latest = { ep, progress: prog };
    }
  }
  return latest;
}

export async function refreshLibrary() {
  setLoadingState(true);
  try {
    appState.homeCache = null;
    appState.gridCurrentPage = 1;
    appState.gridLastVisibleDoc = null;
    appState.gridPageCursors = [];
    
    await renderLibrary(true);
    showToast("Pustaka berhasil disegarkan", "success");
  } catch (err) {
    setLoadingState(false);
    showToast(`Gagal memuat pustaka: ${String(err)}`, "error");
    renderLibrary();
  }
}
