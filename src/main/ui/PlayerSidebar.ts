import type { FirestoreFilm, FirestoreEpisode } from "../../firestore";
import { getSeasons, getEpisodesBySeason } from "../../firestore";
import { appState } from "../state";

export function renderPlayerSidebar(
  film: FirestoreFilm, 
  currentEp: FirestoreEpisode, 
  onEpisodeClick: (ep: FirestoreEpisode, film: FirestoreFilm) => void
) {
  const sidebarEl = document.getElementById("player-sidebar") as HTMLDivElement;
  const sidebarSeriesTitleEl = document.getElementById("player-sidebar-series-title") as HTMLParagraphElement;
  const sidebarSeasonTabsEl = document.getElementById("player-sidebar-season-tabs") as HTMLDivElement;
  const sidebarEpisodeListEl = document.getElementById("player-sidebar-episode-list") as HTMLDivElement;

  if (!sidebarEl) return;

  if (film.type === "film" || (film.type === "matcha" && (film as any).matchaCategory === "secret")) {
    sidebarEl.style.display = "none";
    const toggleSidebarBtn = document.getElementById("btn-toggle-sidebar");
    if (toggleSidebarBtn) toggleSidebarBtn.style.display = "none";
    return;
  }

  sidebarEl.style.display = appState.isPlayerSidebarCollapsed ? "none" : "flex";
  
  const toggleSidebarBtn = document.getElementById("btn-toggle-sidebar");
  if (toggleSidebarBtn) {
    toggleSidebarBtn.style.display = "inline-flex";
    const textSpan = toggleSidebarBtn.querySelector("span");
    if (textSpan) {
      textSpan.textContent = appState.isPlayerSidebarCollapsed ? "Tampilkan Episode" : "Sembunyikan Episode";
    }
  }

  if (sidebarSeriesTitleEl) {
    sidebarSeriesTitleEl.textContent = film.title;
  }

  const seasons = getSeasons(film);
  const activeSeason = currentEp.season ?? seasons[0] ?? 1;

  function renderSidebarEpisodesForSeason(season: number) {
    if (!sidebarEpisodeListEl) return;
    
    const episodes = seasons.length > 0
      ? getEpisodesBySeason(film, season)
      : film.episodes || [];

    sidebarEpisodeListEl.innerHTML = episodes.map((e, idx) => {
      const isActive = e.id === currentEp.id;
      const displayNum = e.episodeNumber !== undefined && e.episodeNumber !== null ? e.episodeNumber : (idx + 1);
      return `
        <div class="episode-item ${isActive ? "active" : ""}" data-epid="${e.id}" style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-md); background: ${isActive ? 'rgba(239, 18, 35, 0.15)' : 'var(--bg-elevated)'}; border: 1.5px solid ${isActive ? 'var(--accent-primary)' : 'transparent'}; cursor: pointer; transition: all var(--transition-fast);">
          <div class="ep-num" style="width: 24px; height: 24px; border-radius: var(--radius-sm); background: var(--accent-gradient); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0;">${displayNum}</div>
          <div class="ep-info" style="flex: 1; overflow: hidden;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="ep-title" style="font-size: 12.5px; font-weight: 500; color: ${isActive ? '#fff' : 'var(--text-secondary)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${e.title || `Episode ${displayNum}`}</span>
            </div>
          </div>
        </div>`;
    }).join("");

    sidebarEpisodeListEl.querySelectorAll<HTMLDivElement>(".episode-item").forEach(el => {
      el.addEventListener("click", () => {
        const epId = el.dataset.epid!;
        const selectedEp = episodes.find(e => e.id === epId);
        if (selectedEp) {
          onEpisodeClick(selectedEp, film);
        }
      });
    });
  }

  if (seasons.length > 1) {
    if (sidebarSeasonTabsEl) {
      sidebarSeasonTabsEl.style.display = "flex";
      sidebarSeasonTabsEl.innerHTML = seasons.map(s => `
        <button class="season-tab ${s === activeSeason ? 'active' : ''}" data-season="${s}" style="padding: 4px 10px; font-size: 11px;">Season ${s}</button>
      `).join("");
      
      sidebarSeasonTabsEl.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
          sidebarSeasonTabsEl.querySelectorAll(".season-tab").forEach(t => t.classList.remove("active"));
          btn.classList.add("active");
          const s = parseInt(btn.dataset.season!);
          renderSidebarEpisodesForSeason(s);
        });
      });
    }
  } else {
    if (sidebarSeasonTabsEl) {
      sidebarSeasonTabsEl.style.display = "none";
    }
  }

  renderSidebarEpisodesForSeason(activeSeason);
}
