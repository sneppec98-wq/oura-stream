import { UploadState, ToastType } from './types';
import { UploadDomRefs } from './dom';
import { searchTMDB, getPosterUrl, TMDBResult } from './tmdb';

export function initializeTMDB(
  state: UploadState,
  dom: UploadDomRefs,
  showToast: (msg: string, type?: ToastType) => void
) {
  if (!dom.btnTmdbSearch || !dom.tmdbSearchModal) return;

  // Render function for TMDB results
  const renderTMDBResults = (results: TMDBResult[]) => {
    dom.tmdbListContainer.innerHTML = '';
    dom.tmdbLoading.style.display = 'none';

    if (results.length === 0) {
      dom.tmdbListContainer.innerHTML = '<div style="color: #fff; grid-column: 1 / -1; text-align: center; padding: 20px;">Tidak ditemukan hasil.</div>';
      return;
    }

    results.forEach(item => {
      // Create card
      const card = document.createElement('div');
      card.className = 'r2-item file-item'; // reuse styling from r2-item
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.gap = '8px';
      card.style.padding = '8px';
      card.style.border = '1px solid var(--border-medium)';
      card.style.borderRadius = '8px';
      card.style.cursor = 'pointer';
      card.style.transition = 'all 0.2s';
      card.style.background = 'rgba(255,255,255,0.02)';

      card.onmouseover = () => { card.style.background = 'rgba(255,255,255,0.08)'; };
      card.onmouseout = () => { card.style.background = 'rgba(255,255,255,0.02)'; };

      const title = item.title || item.name || 'Unknown';
      const year = (item.release_date || item.first_air_date || '').split('-')[0] || '';
      const posterUrl = getPosterUrl(item.poster_path, 'w500');

      card.innerHTML = `
        <div style="width: 100%; aspect-ratio: 2/3; background: #222; border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center;">
          ${posterUrl ? `<img src="${posterUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="color: #666; font-size: 24px;">🎞️</span>`}
        </div>
        <div style="text-align: center; width: 100%;">
          <div style="font-size: 13px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${title}">${title}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${year} • ${item.vote_average ? item.vote_average.toFixed(1) : '-'}</div>
        </div>
      `;

      card.addEventListener('click', () => {
        // Auto-fill form
        dom.elTitle.value = title;
        dom.elYear.value = year;
        if (item.vote_average) dom.elRating.value = item.vote_average.toFixed(1);
        if (item.origin_country && item.origin_country.length > 0) {
           // Mapping some common codes to full names if we want, or just set the country code
           dom.elCountry.value = item.origin_country[0];
        }

        // Set poster
        if (posterUrl) {
          state.lockedBannerUrl = getPosterUrl(item.poster_path, 'original'); // use high-res for DB
          dom.elBannerPrevContainer.style.display = 'block';
          dom.elBannerPreview.src = posterUrl; // use w500 for preview
          dom.elBannerPlaceholder.style.display = 'none';
          dom.elBannerName.textContent = "Sumber: TMDB";
        }

        showToast(`Berhasil mengambil info: ${title}`, 'success');
        dom.tmdbSearchModal.classList.remove('open');
      });

      dom.tmdbListContainer.appendChild(card);
    });
  };

  dom.btnTmdbSearch.addEventListener('click', async () => {
    const query = dom.elTitle.value.trim();
    if (!query) {
      showToast('Ketikkan judul film/series terlebih dahulu di kolom judul!', 'error');
      dom.elTitle.focus();
      return;
    }

    dom.tmdbSearchModal.classList.add('open');
    dom.tmdbLoading.style.display = 'flex';
    dom.tmdbListContainer.innerHTML = '';

    try {
      // Selalu gunakan 'multi' agar bisa mencari Film dan Series sekaligus,
      // karena kadang admin lupa memindahkan tab sebelum mencari
      const results = await searchTMDB(query, 'multi');
      renderTMDBResults(results);
    } catch (err: any) {
      dom.tmdbLoading.style.display = 'none';
      dom.tmdbListContainer.innerHTML = `<div style="color: #ff4757; grid-column: 1 / -1; text-align: center; padding: 20px;">${err.message || "Gagal mengambil data dari TMDB."}</div>`;
    }
  });

  dom.btnTmdbClose.addEventListener('click', () => {
    dom.tmdbSearchModal.classList.remove('open');
  });
}
