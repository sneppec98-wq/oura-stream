import type { FirestoreFilm } from "../../firestore";
import { appState } from "../state";
import { getWatchProgress } from "../watch";

export function createMediaCardHTML(film: FirestoreFilm): string {
  const typeLabel = film.type === 'film' ? 'Film' : 'Series';
  const badgeClass = film.type === 'film' ? 'badge-movie' : 'badge-series';
  
  let posterContent = "";
  const firstEp = film.episodes?.[0];
  const videoUrl = firstEp?.videoUrl || "";
  const isDirectVideo = !!videoUrl.match(/\.(mp4|webm|ogg|mov|mkv)(\?.*)?$/i);
  
  const isMatcha = film.type === "matcha";
  const posterUrl = film.bannerUrl || firstEp?.posterUrl || "";

  if (isMatcha) {
    if (posterUrl) {
      posterContent = `<img class="card-poster landscape" src="${posterUrl}" alt="${film.title}" loading="lazy">`;
    } else if (isDirectVideo) {
      posterContent = `<video class="card-poster landscape card-video-preview" src="${videoUrl}" preload="metadata" muted playsinline style="object-fit: cover; width: 100%; height: 100%; pointer-events: none; display: block;"></video>`;
    } else if ((film as any).matchaCategory === "secret") {
      posterContent = `
        <div class="card-poster-placeholder landscape matcha-secret-placeholder" style="background: linear-gradient(135deg, #1b2615 0%, #0d120a 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
          <span style="font-size: 24px; filter: drop-shadow(0 0 10px rgba(139, 195, 74, 0.4));">🤫</span>
          <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 2px; color: #8bc34a; font-weight: 700; opacity: 0.8;">Secret Matcha</span>
        </div>`;
    } else {
      posterContent = `<div class="card-poster-placeholder landscape"><span>🎬</span></div>`;
    }
  } else {
    if (posterUrl) {
      posterContent = `<img class="card-poster" src="${posterUrl}" alt="${film.title}" loading="lazy">`;
    } else if (isDirectVideo) {
      posterContent = `<video class="card-poster card-video-preview" src="${videoUrl}" preload="metadata" muted playsinline style="object-fit: cover; width: 100%; height: 100%; pointer-events: none; display: block;"></video>`;
    } else {
      posterContent = `<div class="card-poster-placeholder"><span>🎬</span></div>`;
    }
  }
  
  const isChecked = appState.selectedMatchaIds.includes(film.id);
  const checkboxHTML = isMatcha 
    ? `<div class="card-select-checkbox-wrapper" style="position: absolute; top: 8px; left: 8px; z-index: 12; display: none;">
         <input type="checkbox" class="matcha-card-checkbox" data-id="${film.id}" style="width: 18px; height: 18px; accent-color: #8bc34a; cursor: pointer;" ${isChecked ? 'checked' : ''}>
       </div>`
    : "";

  const cardClass = isMatcha ? "media-card landscape-card" : "media-card banner-card";

  const epsCount = film.episodes?.length || 0;
  const seasonsSet = new Set(film.episodes?.map(e => e.season).filter(s => s != null));
  const seasonsCount = seasonsSet.size;
  const seriesInfoHtml = film.type === 'series' && epsCount > 0 
    ? `<span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.1);">${seasonsCount > 0 ? `${seasonsCount} Ssn, ` : ''}${epsCount} Eps</span>`
    : '';

  return `
    <div class="${cardClass}" data-id="${film.id}" id="card-${film.id}">
      <div class="card-poster-wrapper">
        ${checkboxHTML}
        ${posterContent}
        <div class="card-overlay">
          <button class="card-play-btn" data-id="${film.id}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="color: #fff; margin-left: 2px;">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title">${film.title}</div>
        <div class="card-meta">
          ${film.type !== "matcha" ? `<span class="card-type-badge ${badgeClass}">${typeLabel}</span>` : ""}
          ${seriesInfoHtml}
          ${(film.releaseYear && film.releaseYear !== 0 && film.releaseYear !== '0' && String(film.releaseYear).trim() !== '') ? `<span>${film.releaseYear}</span>` : ''}
          ${(film.rating && film.rating > 0) ? `
          <div class="card-rating-row" style="margin-left: auto; display: inline-flex; align-items: center; gap: 4px;">
            <span class="star-icon">★</span>
            <span class="rating-val">${Number(film.rating).toFixed(1)}</span>
          </div>` : ''}
        </div>
      </div>
    </div>`;
}

export function createContinueWatchingCardHTML(film: FirestoreFilm, progress: ReturnType<typeof getWatchProgress>) {
  const actualProgress = progress ?? { currentTime: 0, duration: 0, timestamp: 0 };
  const pct = actualProgress.duration ? Math.round((actualProgress.currentTime / actualProgress.duration) * 100) : 0;
  const curHours = Math.floor(actualProgress.currentTime / 3600);
  const curMins = Math.floor((actualProgress.currentTime % 3600) / 60).toString().padStart(2, '0');
  const curSecs = Math.floor(actualProgress.currentTime % 60).toString().padStart(2, '0');
  const curStr = `${curHours.toString().padStart(2, '0')}:${curMins}:${curSecs}`;
  const durHours = Math.floor(actualProgress.duration / 3600);
  const durMins = Math.floor((actualProgress.duration % 3600) / 60).toString().padStart(2, '0');
  const durSecs = Math.floor(actualProgress.duration % 60).toString().padStart(2, '0');
  const durStr = `${durHours.toString().padStart(2, '0')}:${durMins}:${durSecs}`;
  
  return `
    <div class="continue-card" data-id="${film.id}" id="card-${film.id}" style="flex-shrink: 0; width: 120px; height: 180px; cursor: pointer; border-radius: 10px; overflow: hidden; background: #1a1a1a; border: 1px solid #333; display: flex; flex-direction: column; position: relative;">
      <img src="${film.bannerUrl || ''}" alt="${film.title}" style="width: 100%; flex: 1; min-height: 0; object-fit: cover; display: block;" loading="lazy" />
      <div style="height: 3px; background: rgba(255,255,255,0.2); width: 100%; flex-shrink: 0;">
        <div style="height: 100%; width: ${pct}%; background: #ff4757;"></div>
      </div>
      <div style="padding: 6px 8px; background: #111; flex-shrink: 0;">
        <p style="font-size: 11px; font-weight: 700; color: #fff; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${film.title}</p>
        <p style="font-size: 10px; color: #888; margin: 2px 0 0;">${curStr} / ${durStr}</p>
      </div>
      <button class="card-play-btn" style="display: none;" data-id="${film.id}"></button>
    </div>
  `;
}
