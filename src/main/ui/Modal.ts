import type { FirestoreFilm } from "../../firestore";
import { getSeasons, getEpisodesBySeason, getFirstPlayableEpisode, formatFilmType, deleteFilmFirestore } from "../../firestore";
import { appState, saveAppState, isSuperAdmin } from "../state";
import { playEpisode } from "../player";
import { showCustomConfirm, showToast } from "../dialogs";
import { switchView, refreshLibrary } from "../library";
import { getWatchProgress } from "../watch";
import { toggleMyListId, isInMyList, renderMyListView } from "../mylist";

export function openDetailModal(film: FirestoreFilm) {
  const seasons = getSeasons(film);
  appState.activeDetailSeason = seasons[0] ?? 1;

  const modal = document.getElementById("detail-modal")!;
  const body = document.getElementById("detail-modal-body")!;

  let poster = "";
  let detailHeroStyle = "";
  if (film.bannerUrl) {
    poster = `<img src="${film.bannerUrl}" alt="${film.title}" onerror="this.parentElement.innerHTML='<div class=\\'detail-hero-placeholder\\'>🎬</div>'">`;
    detailHeroStyle = `style="background-image: url('${film.bannerUrl}'); background-size: cover; background-position: center;"`;
  } else if (film.type === "matcha" && (film as any).matchaCategory === "secret") {
    poster = `
      <div class="detail-hero-placeholder matcha-secret-placeholder" style="background: linear-gradient(135deg, #1b2615 0%, #0d120a 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; width: 100%; height: 100%;">
        <span style="font-size: 48px; filter: drop-shadow(0 0 15px rgba(139, 195, 74, 0.5));">🤫</span>
        <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 3px; color: #8bc34a; font-weight: 700; opacity: 0.8;">Secret Matcha</span>
      </div>`;
    detailHeroStyle = `style="background: linear-gradient(135deg, #1b2615 0%, #0d120a 100%);"`;
  } else {
    poster = `<div class="detail-hero-placeholder">🎬</div>`;
    detailHeroStyle = "";
  }

  const isFilm = film.type === "film";
  const firstEp = getFirstPlayableEpisode(film);
  const isDraft = film.status === "draft";

  const seasonTabsHTML = !isFilm && seasons.length > 1
    ? `<div class="season-tabs" id="season-tabs">
        ${seasons.map((s, i) => `<button class="season-tab ${i === 0 ? "active" : ""}" data-season="${s}">Season ${s}</button>`).join("")}
       </div>`
    : "";

  const episodesCountHTML = isDraft
    ? `<div style="font-size: 13px; color: #00acee; font-weight: 600; display: flex; align-items: center; gap: 6px; margin: 12px 0;">
        <span>⏳</span> Segera Hadir / Coming Soon
       </div>`
    : `<div class="detail-episode-count">${(film.episodes || []).length} episode${(film.episodes || []).length !== 1 ? "s" : ""}</div>`;

  const playOrEpisodeHTML = isDraft
    ? `<div style="margin-top: 24px; padding: 16px; background: rgba(0, 172, 238, 0.08); border: 1px solid rgba(0, 172, 238, 0.15); border-radius: 8px; color: #bde5f8; font-size: 13px; line-height: 1.5; display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 20px;">🎬</span>
        <span>Konten ini belum memiliki video yang tersedia dan akan segera dirilis. Silakan kembali lagi nanti!</span>
       </div>`
    : (isFilm && firstEp ? `
        <button class="btn-primary detail-play-btn" id="detail-movie-play">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Putar Sekarang
        </button>
      ` : (!isFilm ? `
        ${seasonTabsHTML}
        <div class="episode-list" id="episode-list"></div>
      ` : ""));

  const detailMyListButtonHTML = `
    <button class="btn btn-secondary" id="btn-toggle-mylist" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #fff;">
      ${isInMyList(film.id) ? "Hapus dari My List" : "Tambah ke My List"}
    </button>
  `;

  body.innerHTML = `
    <div class="detail-hero" ${detailHeroStyle}>
      <div style="backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); background: rgba(0,0,0,0.5); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; position: absolute; inset: 0;">
        ${poster}
      </div>
      <div class="detail-hero-overlay"></div>
    </div>
    <div class="detail-body">
      <div class="detail-type-row" style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="card-type-badge ${film.type === "film" ? "badge-movie" : "badge-series"}">${formatFilmType(film)}</span>
          ${film.country ? `<span class="detail-country">${film.country}</span>` : ""}
          ${(film.releaseYear && film.releaseYear !== 0 && film.releaseYear !== '0' && String(film.releaseYear).trim() !== '') ? `<span class="detail-year">${film.releaseYear}</span>` : ""}
          ${(film.rating && film.rating > 0) ? `
          <div class="side-item-rating">
            <span class="star-icon">★</span>
            <span class="rating-val">${Number(film.rating).toFixed(1)}</span>
          </div>` : ""}
        </div>
        ${isSuperAdmin() ? `
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-small" id="btn-edit-content" style="background: rgba(255, 255, 255, 0.1); border: 1px solid var(--border-subtle); color: #ffaa5e; cursor: pointer; padding: 4px 10px; border-radius: 6px; font-size: 11px; display: flex; align-items: center; gap: 4px;">✏️ Edit</button>
            ${film.type === "matcha" ? `<button class="btn btn-small" id="btn-delete-content" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #FCA5A5; cursor: pointer; padding: 4px 10px; border-radius: 6px; font-size: 11px; display: flex; align-items: center; gap: 4px;">🗑️ Hapus</button>` : ""}
          </div>
        ` : ""}
      </div>
      <h2 class="detail-title">${film.title}</h2>
      <div style="display:flex; flex-wrap:wrap; gap:10px; margin: 12px 0;">
        ${detailMyListButtonHTML}
      </div>
      ${episodesCountHTML}
      ${playOrEpisodeHTML}
    </div>`;

  modal.classList.add("open");

  if (isSuperAdmin()) {
    document.getElementById("btn-edit-content")?.addEventListener("click", () => {
      closeDetailModal();
      (window as any).startEditingFilm(film);
      switchView("view-upload", "nav-downloads");
      saveAppState();
    });
    if (film.type === "matcha") {
      document.getElementById("btn-delete-content")?.addEventListener("click", async () => {
        const confirmDelete = await showCustomConfirm("Konfirmasi Hapus", `Apakah Anda yakin ingin menghapus Matcha "${film.title}"?`);
        if (!confirmDelete) return;
        
        try {
          const loadingEl = document.getElementById("library-loading");
          if (loadingEl) loadingEl.style.display = "flex";
          await deleteFilmFirestore(film.id, film.type);
          closeDetailModal();
          showToast("Matcha berhasil dihapus!", "success");
          await refreshLibrary();
        } catch (err: any) {
          showToast(`Gagal menghapus: ${err.message}`, "error");
        } finally {
          const loadingEl = document.getElementById("library-loading");
          if (loadingEl) loadingEl.style.display = "none";
        }
      });
    }
  }

  document.getElementById("btn-toggle-mylist")?.addEventListener("click", () => {
    const isAdded = toggleMyListId(film.id);
    const btn = document.getElementById("btn-toggle-mylist");
    if (btn) {
      btn.textContent = isAdded ? "Hapus dari My List" : "Tambah ke My List";
    }
    showToast(
      isAdded ? "Film ditambahkan ke My List." : "Film dihapus dari My List.",
      "success"
    );
    if (document.getElementById("view-mylist")?.classList.contains("active")) {
      renderMyListView().catch(() => {});
    }
  });

  if (!isFilm && !isDraft) renderEpisodeList(film, appState.activeDetailSeason);

  document.getElementById("detail-movie-play")?.addEventListener("click", () => {
    if (firstEp) playEpisode(firstEp, film);
  });

  document.getElementById("season-tabs")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-season]") as HTMLElement | null;
    if (!btn) return;
    document.querySelectorAll(".season-tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    appState.activeDetailSeason = parseInt(btn.dataset.season!);
    renderEpisodeList(film, appState.activeDetailSeason);
  });
}

export function renderEpisodeList(film: FirestoreFilm, season: number) {
  const list = document.getElementById("episode-list");
  if (!list) return;

  const seasons = getSeasons(film);
  const episodes = seasons.length > 0
    ? getEpisodesBySeason(film, season)
    : film.episodes || [];

  if (episodes.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted);font-size:13px;padding:8px 0;">Belum ada episode.</p>`;
    return;
  }

  list.innerHTML = episodes.map((ep, i) => {
    const prog = getWatchProgress(film.id, ep.id);
    const pct = prog ? Math.min(100, (prog.currentTime / prog.duration) * 100) : 0;
    const displayNum = ep.episodeNumber !== undefined && ep.episodeNumber !== null ? ep.episodeNumber : (i + 1);

    return `
      <div class="episode-item" data-epid="${ep.id}">
        <div class="ep-num">${displayNum}</div>
        <div class="ep-info">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="ep-title">${ep.title || `Episode ${displayNum}`}</span>
            ${(ep.releaseYear && ep.releaseYear !== 0 && ep.releaseYear !== '0' && String(ep.releaseYear).trim() !== '') ? `<span class="ep-year-badge" style="font-size: 10px; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${ep.releaseYear}</span>` : ""}
          </div>
          ${pct > 1 ? `<div class="ep-progress-bar"><div class="ep-progress-fill" style="width:${pct}%"></div></div>` : ""}
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll<HTMLDivElement>(".episode-item").forEach(el => {
    el.addEventListener("click", () => {
      const ep = episodes.find(e => e.id === el.dataset.epid);
      if (ep) playEpisode(ep, film);
    });
  });
}

export function closeDetailModal() {
  document.getElementById("detail-modal")?.classList.remove("open");
}
