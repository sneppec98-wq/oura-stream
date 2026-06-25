import type { UploadState } from './types';
import type { UploadDomRefs } from './dom';

export interface EpisodeRendererOptions {
  onBrowseByse: (index: number) => void;
  onBrowseR2?: (index: number) => void;
}

export function syncEpisodeMetadata(state: UploadState) {
  state.episodes.forEach((ep) => {
    if (state.type === 'series') {
      ep.season = state.hasSeason ? state.activeSeasonTab : null;
      if (state.seriesCategory === 'tv') {
        ep.releaseYear = 0;
      } else {
        ep.releaseYear = Number(ep.releaseYear) || 0;
      }
    } else {
      ep.season = null;
      ep.releaseYear = Number(ep.releaseYear) || 0;
    }
  });
}

export function updateMatchaStorageUI(state: UploadState) {
  const upMatchaStorageLabel = document.getElementById('up-matcha-storage-toggle-label');
  const upMatchaStorage = document.getElementById('up-matcha-storage') as HTMLInputElement | null;
  const upMatchaStorageLabelText = document.getElementById('up-matcha-storage-label-text');
  if (!upMatchaStorageLabel || !upMatchaStorage || !upMatchaStorageLabelText) return;

  if (state.matchaCategory === 'secret') {
    upMatchaStorage.style.display = '';
    upMatchaStorageLabelText.textContent = 'Simpan sebagai Video Terpisah (Storage)';
    upMatchaStorage.checked = true;
  } else {
    upMatchaStorage.style.display = 'none';
    upMatchaStorageLabelText.textContent = 'Koleksi';
    upMatchaStorage.checked = false;
  }
}

export function renderSeasons(
  state: UploadState,
  dom: UploadDomRefs,
  options: EpisodeRendererOptions
) {
  dom.elSeasonList.innerHTML = state.seasonTabs
    .map((s) => `
      <button type="button" class="btn-small ${state.activeSeasonTab === s ? 'active' : ''}" data-season="${s}" style="font-size: 12px; padding: 6px 14px;">Season ${s}</button>
    `)
    .join('');

  dom.elSeasonList.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const season = parseInt((e.target as HTMLButtonElement).getAttribute('data-season') || '1', 10);
      state.activeSeasonTab = season;
      renderSeasons(state, dom, options);
      renderEpisodes(state, dom, options);
    });
  });
}

export function renderEpisodes(state: UploadState, dom: UploadDomRefs, options: EpisodeRendererOptions) {
  let controls = document.getElementById('up-episodes-controls');
  if (!controls) {
    controls = document.createElement('div');
    controls.id = 'up-episodes-controls';
    controls.style.display = 'flex';
    controls.style.justifyContent = 'space-between';
    controls.style.alignItems = 'center';
    controls.style.marginBottom = '8px';
    dom.elEpisodesList.parentElement?.insertBefore(controls, dom.elEpisodesList);
  }

  const filtered = state.episodes
    .map((ep, idx) => ({ ep, idx }))
    .filter((item) => (state.hasSeason ? item.ep.season === state.activeSeasonTab : true));

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / state.episodePageSize));
  if (state.episodePage > totalPages) state.episodePage = totalPages;

  const start = (state.episodePage - 1) * state.episodePageSize;
  const end = start + state.episodePageSize;

  controls.innerHTML = '';
  const left = document.createElement('div');
  left.style.display = 'flex';
  left.style.gap = '8px';
  const btnPrev = document.createElement('button');
  btnPrev.type = 'button';
  btnPrev.className = 'btn-small';
  btnPrev.textContent = '← Prev';
  btnPrev.disabled = state.episodePage <= 1;
  const btnNext = document.createElement('button');
  btnNext.type = 'button';
  btnNext.className = 'btn-small';
  btnNext.textContent = 'Next →';
  btnNext.disabled = state.episodePage >= totalPages;
  btnPrev.addEventListener('click', () => {
    state.episodePage = Math.max(1, state.episodePage - 1);
    renderEpisodes(state, dom, options);
  });
  btnNext.addEventListener('click', () => {
    state.episodePage = Math.min(totalPages, state.episodePage + 1);
    renderEpisodes(state, dom, options);
  });
  left.appendChild(btnPrev);
  left.appendChild(btnNext);

  const center = document.createElement('div');
  center.style.fontSize = '12px';
  center.style.color = 'var(--text-secondary)';
  center.textContent = `Page ${state.episodePage} / ${totalPages} — ${totalItems} item(s)`;

  const right = document.createElement('div');
  right.style.display = 'flex';
  right.style.gap = '8px';
  const sizeSel = document.createElement('select');
  [2, 3, 5, 10, 20, 50].forEach((n) => {
    const opt = document.createElement('option');
    opt.value = String(n);
    opt.textContent = String(n);
    if (n === state.episodePageSize) opt.selected = true;
    sizeSel.appendChild(opt);
  });
  sizeSel.addEventListener('change', (e) => {
    state.episodePageSize = parseInt((e.target as HTMLSelectElement).value, 10) || 10;
    state.episodePage = 1;
    renderEpisodes(state, dom, options);
  });
  const sizeLabel = document.createElement('span');
  sizeLabel.style.fontSize = '12px';
  sizeLabel.style.color = 'var(--text-secondary)';
  sizeLabel.textContent = 'Per halaman:';
  right.appendChild(sizeLabel);
  right.appendChild(sizeSel);

  controls.appendChild(left);
  controls.appendChild(center);
  controls.appendChild(right);

  dom.elEpisodesList.innerHTML = '';

  const pageSlice = filtered.slice(start, end);
  pageSlice.forEach((item, sliceIdx) => {
    const ep = item.ep;
    const i = item.idx;
    const localIndex = start + sliceIdx + 1;
    const isFilm = state.type === 'film';
    const isSeries = state.type === 'series';
    const showMoviePoster = isSeries && state.seriesCategory === 'movie';
    const currentEpNum = ep.episodeNumber !== undefined && ep.episodeNumber !== null ? ep.episodeNumber : localIndex;
    const titlePrefix = showMoviePoster
      ? `MOVIE ${currentEpNum}`
      : isSeries
      ? `EP ${currentEpNum}`
      : `FILE ${currentEpNum}`;

    const epDiv = document.createElement('div');
    epDiv.className = 'video-card-item';
    epDiv.innerHTML = `
      <div class="video-card-header">
        <div class="video-card-header-left">
          <span class="fi-num">${titlePrefix}</span>
          <input class="input ep-title" placeholder="Judul Video/Episode" value="${ep.title}">
        </div>
        <input class="input ep-url" placeholder="Masukkan URL embed Byse atau kode <iframe>..." value="${ep.videoUrl}">
        <div class="video-card-header-actions">
          ${!isFilm ? `
            <input class="input ep-num-input" type="number" min="1" placeholder="Eps" value="${ep.episodeNumber || ''}" title="Nomor Episode">
            <input class="input ep-season" type="number" min="1" placeholder="Ssn" value="${ep.season || ''}" ${!state.hasSeason ? 'disabled' : ''}>
            <input class="input ep-year" type="text" placeholder="Tahun" value="${ep.releaseYear || ''}">
          ` : ''}
          <button type="button" class="btn-close ep-delete" title="Hapus Item">✕</button>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn-small st-r2-browse" style="border-color: rgba(0, 172, 238, 0.4); color: #00acee; cursor: pointer;">📁 Browse R2</button>
          </div>
        </div>
      </div>
    `;

    epDiv.querySelector('.ep-title')?.addEventListener('input', (e) => {
      ep.title = (e.target as HTMLInputElement).value;
    });

    const epNumInput = epDiv.querySelector('.ep-num-input') as HTMLInputElement | null;
    if (epNumInput) {
      epNumInput.addEventListener('input', (e) => {
        const value = parseInt((e.target as HTMLInputElement).value, 10);
        ep.episodeNumber = Number.isNaN(value) ? null : value;
        const prefixSpan = epDiv.querySelector('.fi-num');
        if (prefixSpan) {
          const updatedEpNum = ep.episodeNumber !== null && ep.episodeNumber !== undefined ? ep.episodeNumber : localIndex;
          prefixSpan.textContent = showMoviePoster ? `MOVIE ${updatedEpNum}` : isSeries ? `EP ${updatedEpNum}` : `FILE ${updatedEpNum}`;
        }
      });
    }

    const epSeasonInput = epDiv.querySelector('.ep-season') as HTMLInputElement | null;
    if (epSeasonInput) {
      epSeasonInput.addEventListener('input', (e) => {
        const value = parseInt((e.target as HTMLInputElement).value, 10);
        ep.season = Number.isNaN(value) ? null : value;
      });
    }

    const epYearInput = epDiv.querySelector('.ep-year') as HTMLInputElement | null;
    if (epYearInput) {
      epYearInput.addEventListener('input', (e) => {
        ep.releaseYear = (e.target as HTMLInputElement).value;
      });
    }

    epDiv.querySelector('.ep-delete')?.addEventListener('click', () => {
      state.episodes.splice(i, 1);
      renderEpisodes(state, dom, options);
    });

    const epUrlInput = epDiv.querySelector('.ep-url') as HTMLInputElement;
    epUrlInput.value = ep.videoUrl || '';
    epUrlInput.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      ep.videoUrl = val;
      ep.storage = val.trim() ? 'iframe' : '';
    });

    epDiv.querySelector('.st-r2-browse')?.addEventListener('click', () => {
      state.activeEpIdx = i;
      options.onBrowseR2?.(i);
    });

    dom.elEpisodesList.appendChild(epDiv);
  });
}
