import { getUploadDomRefs } from './dom';
import { parseYearInput } from './helpers';
import { renderEpisodes, renderSeasons, syncEpisodeMetadata, updateMatchaStorageUI } from './episodes';
import { initializeR2Browser, fetchR2Files, autoDetectVideosFromR2 } from './r2';
import { handleSubmit } from './submit';
import type { UploadState, ToastType } from './types';

export function setupUploadLogic(
  showToast: (msg: string, type?: ToastType) => void,
  navigateHome: () => void
) {
  const dom = getUploadDomRefs();

  const state: UploadState = {
    type: 'film',
    seriesCategory: 'tv',
    matchaCategory: 'bl_series',
    hasSeason: false,
    activeSeasonTab: 1,
    seasonTabs: [1],
    bannerFile: null,
    bannerPrev: '',
    lockedBannerUrl: '',
    episodes: [
      { title: '', releaseYear: 0, videoUrl: '', storage: '', season: null, posterFile: null, posterPreview: '', posterUrl: '', episodeNumber: null },
      { title: '', releaseYear: 0, videoUrl: '', storage: '', season: null, posterFile: null, posterPreview: '', posterUrl: '', episodeNumber: null }
    ],
    r2Files: { objects: [], folders: [] },
    currentPrefix: 'uploads/',
    activeEpIdx: null,
    uploading: false,
    episodePage: 1,
    episodePageSize: 3,
    editingFilmId: null,
    editingFilmCreatedAt: null,
    editingFilmUploadedBy: null,
    currentFolderId: '0',
    selectedByseFiles: [],
    byseFoldersList: [],
    byseFilesList: [],
    visibleFiles: [],
    folderNamesCache: { '0': 'Root' },
    uploadStatus: 'published',
  };

  const onBrowseR2 = (index: number) => {
    state.activeEpIdx = index;
    state.currentPrefix = 'uploads/';
    const searchInput = document.getElementById('r2-search-input') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';
    (window as any).__setR2AutoDetectMode?.(false);
    fetchR2Files(state, showToast);
    document.getElementById('r2-browser-modal')?.classList.add('open');
  };

  const episodeRendererOptions = {
    onBrowseByse: () => {}, // unused
    onBrowseR2
  };

  function switchUploadTab(tab: 'info' | 'content') {
    dom.elUploadTabs.forEach((btn) => {
      const btnTab = btn.getAttribute('data-upload-tab');
      if (btnTab === tab) {
        btn.classList.add('active');
        btn.classList.remove('btn-ghost');
        btn.classList.add('btn-primary');
      } else {
        btn.classList.remove('active');
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-ghost');
      }
    });

    if (tab === 'info') {
      dom.elUploadTabInfo.style.display = 'flex';
      dom.elUploadTabContent.style.display = 'none';
      dom.elUploadGrid.classList.remove('tab-content-only');
      dom.elUploadGrid.classList.add('tab-info-only');
    } else {
      dom.elUploadTabInfo.style.display = 'none';
      dom.elUploadTabContent.style.display = 'flex';
      dom.elUploadGrid.classList.remove('tab-info-only');
      dom.elUploadGrid.classList.add('tab-content-only');
    }
  }

  dom.elUploadTabs.forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      const tab = tabBtn.getAttribute('data-upload-tab') as 'info' | 'content';
      if (tab) switchUploadTab(tab);
    });
  });

  dom.elStatusBtns.forEach((statusBtn) => {
    statusBtn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const newStatus = target.getAttribute('data-status') as 'draft' | 'published';
      state.uploadStatus = newStatus;
      dom.elStatusBtns.forEach((btn) => {
        if (btn.getAttribute('data-status') === newStatus) {
          btn.classList.add('active');
          btn.style.background = 'var(--accent)';
          btn.style.color = '#000';
          btn.style.fontWeight = '600';
        } else {
          btn.classList.remove('active');
          btn.style.background = 'transparent';
          btn.style.color = '#fff';
          btn.style.fontWeight = '400';
        }
      });
      const submitText = state.uploadStatus === 'draft' ? 'Simpan Sebagai Draft' : 'Publikasikan Konten';
      setSubmitButtonText(submitText);
    });
  });

  dom.elEpisodesList.addEventListener('wheel', (event) => {
    const target = event.currentTarget as HTMLElement;
    const deltaY = event.deltaY;
    const atTop = target.scrollTop === 0;
    const atBottom = Math.ceil(target.scrollTop + target.clientHeight) >= target.scrollHeight;

    if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) {
      event.stopPropagation();
      event.preventDefault();
    }
  }, { passive: false });

  function setSubmitButtonText(text: string) {
    const span = dom.btnSubmit.querySelector('span');
    if (span) {
      span.textContent = text;
    } else {
      dom.btnSubmit.textContent = text;
    }
  }

  function resetUploadForm() {
    state.editingFilmId = null;
    state.editingFilmCreatedAt = null;
    state.editingFilmUploadedBy = null;
    switchUploadTab('info');

    dom.elTitle.value = '';
    dom.elYear.value = '0';
    dom.elCountry.value = '';
    dom.elRating.value = '0';

    dom.elTypeBtns.forEach((btn) => { btn.classList.remove('btn-primary'); btn.classList.add('btn-ghost'); });
    const btnTypeFilm = document.querySelector('#up-type-group [data-type="film"]') as HTMLElement;
    if (btnTypeFilm) {
      btnTypeFilm.classList.remove('btn-ghost');
      btnTypeFilm.classList.add('btn-primary');
    }
    dom.elTypeBtns.forEach((btn) => { btn.style.display = 'inline-flex'; });
    state.type = 'film';
    dom.elSeriesOptions.style.display = 'none';
    dom.elMatchaOptions.style.display = 'none';

    const upMatchaStorageLabel = document.getElementById('up-matcha-storage-toggle-label');
    const upMatchaStorage = document.getElementById('up-matcha-storage') as HTMLInputElement | null;
    if (upMatchaStorageLabel) upMatchaStorageLabel.style.display = 'flex';
    if (upMatchaStorage) upMatchaStorage.checked = false;

    state.seriesCategory = 'tv';
    dom.elCatBtns.forEach((btn) => { btn.classList.remove('btn-primary'); btn.classList.add('btn-ghost'); });
    const btnCatTv = document.querySelector('#up-series-category-group [data-cat="tv"]') as HTMLElement;
    if (btnCatTv) {
      btnCatTv.classList.remove('btn-ghost');
      btnCatTv.classList.add('btn-primary');
    }

    state.matchaCategory = 'bl_series';
    state.bannerFile = null;
    if (state.bannerPrev) URL.revokeObjectURL(state.bannerPrev);
    state.bannerPrev = '';
    state.lockedBannerUrl = '';
    dom.elBannerPreview.src = '';
    dom.elBannerPrevContainer.style.display = 'none';
    dom.elBannerPlaceholder.style.display = 'block';
    dom.elBannerName.textContent = 'Pilih gambar untuk poster (Rekomendasi 2:3)';

    state.episodePage = 1;
    dom.elMatchaCatBtns.forEach((btn) => { btn.classList.remove('btn-primary'); btn.classList.add('btn-ghost'); });
    const btnMatchaCatBl = document.querySelector('#up-matcha-category-group [data-matcha-cat="bl_series"]') as HTMLElement;
    if (btnMatchaCatBl) {
      btnMatchaCatBl.classList.remove('btn-ghost');
      btnMatchaCatBl.classList.add('btn-primary');
    }
    updateMatchaStorageUI(state);

    state.hasSeason = false;
    dom.elHasSeason.checked = false;
    dom.elSeasonTabs.style.display = 'none';
    state.seasonTabs = [1];
    state.activeSeasonTab = 1;

    state.episodePage = 1;
    state.episodes = [
      { title: '', releaseYear: 0, videoUrl: '', storage: '', season: null, posterFile: null, posterPreview: '', posterUrl: '', episodeNumber: null },
      { title: '', releaseYear: 0, videoUrl: '', storage: '', season: null, posterFile: null, posterPreview: '', posterUrl: '', episodeNumber: null }
    ];

    dom.elUploadTitle.textContent = 'Upload Media Baru';
    state.uploadStatus = 'published';
    dom.elStatusBtns.forEach((btn) => {
      if (btn.getAttribute('data-status') === 'published') {
        btn.classList.add('active');
        btn.style.background = 'var(--accent)';
        btn.style.color = '#000';
        btn.style.fontWeight = '600';
      } else {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = '#fff';
        btn.style.fontWeight = '400';
      }
    });
    setSubmitButtonText('Publikasikan Konten');

    renderSeasons(state, dom, episodeRendererOptions);
    renderEpisodes(state, dom, episodeRendererOptions);
  }

  function startEditingFilm(film: any) {
    resetUploadForm();
    state.editingFilmId = film.id;
    state.editingFilmCreatedAt = film.createdAt || null;
    state.editingFilmUploadedBy = film.uploadedBy || null;

    dom.elTitle.value = film.title || '';
    dom.elYear.value = film.releaseYear !== undefined ? String(film.releaseYear) : '0';
    dom.elCountry.value = film.country || '';
    dom.elRating.value = film.rating !== undefined ? String(film.rating) : '0';

    state.type = film.type || 'film';
    dom.elTypeBtns.forEach((btn) => {
      const btnType = btn.getAttribute('data-type');
      if (btnType === state.type) {
        btn.classList.remove('btn-ghost');
        btn.classList.add('btn-primary');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-ghost');
      }
      
      // Strict separation: Matcha vs Film/Series
      if (state.type === 'matcha') {
        if (btnType !== 'matcha') btn.style.display = 'none';
        else btn.style.display = 'inline-flex';
      } else {
        if (btnType === 'matcha') btn.style.display = 'none';
        else btn.style.display = 'inline-flex';
      }
    });

    if (state.type === 'series') {
      dom.elSeriesOptions.style.display = 'block';
      dom.elMatchaOptions.style.display = 'none';
      state.seriesCategory = film.seriesCategory || 'tv';
      dom.elCatBtns.forEach((btn) => {
        const cat = btn.getAttribute('data-cat');
        if (cat === state.seriesCategory) {
          btn.classList.remove('btn-ghost');
          btn.classList.add('btn-primary');
        } else {
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-ghost');
        }
      });
      state.hasSeason = film.hasSeason || false;
      dom.elHasSeason.checked = state.hasSeason;
      dom.elSeasonTabs.style.display = state.hasSeason ? 'flex' : 'none';
    } else if (state.type === 'matcha') {
      dom.elSeriesOptions.style.display = 'none';
      dom.elMatchaOptions.style.display = 'block';
      let storedMatchaCategory = film.matchaCategory || 'bl_series';
      if (storedMatchaCategory === 'bl') {
        storedMatchaCategory = film.seriesCategory === 'movie' ? 'bl_movie' : 'bl_series';
      }
      state.matchaCategory = storedMatchaCategory;
      dom.elMatchaCatBtns.forEach((btn) => {
        const mcat = btn.getAttribute('data-matcha-cat');
        if (mcat === state.matchaCategory) {
          btn.classList.remove('btn-ghost');
          btn.classList.add('btn-primary');
        } else {
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-ghost');
        }
      });
      updateMatchaStorageUI(state);
    } else {
      dom.elSeriesOptions.style.display = 'none';
      dom.elMatchaOptions.style.display = 'none';
    }

    if (film.bannerUrl) {
      state.lockedBannerUrl = film.bannerUrl;
      dom.elBannerPreview.src = film.bannerUrl;
      dom.elBannerPrevContainer.style.display = 'block';
      dom.elBannerPlaceholder.style.display = 'none';
      dom.elBannerName.textContent = 'Banner saat ini (Terunggah)';
    }

    if (film.episodes && film.episodes.length > 0) {
      state.episodes = film.episodes.map((ep: any) => ({
        id: ep.id,
        title: ep.title || '',
        releaseYear: ep.releaseYear !== undefined ? ep.releaseYear : 0,
        videoUrl: ep.videoUrl || '',
        storage: ep.storage || '',
        season: ep.season || null,
        posterFile: null,
        posterPreview: ep.posterUrl || '',
        posterUrl: ep.posterUrl || '',
        episodeNumber: ep.episodeNumber || null,
      }));
      const seasons = film.episodes.map((e: any) => e.season).filter((s: any) => s !== null && s !== undefined);
      if (seasons.length) {
        state.seasonTabs = Array.from(new Set(seasons)).sort((a: any, b: any) => a - b) as number[];
        state.activeSeasonTab = state.seasonTabs[0] || 1;
      } else {
        state.seasonTabs = [1];
        state.activeSeasonTab = 1;
      }
    } else {
      state.episodes = [];
      state.seasonTabs = [1];
      state.activeSeasonTab = 1;
    }

    dom.elUploadTitle.textContent = 'Edit Informasi Film / Series';
    setSubmitButtonText('Simpan Perubahan');

    renderSeasons(state, dom, episodeRendererOptions);
    renderEpisodes(state, dom, episodeRendererOptions);
  }

  (window as any).startEditingFilm = startEditingFilm;
  (window as any).resetUploadForm = resetUploadForm;

  dom.btnCancel.addEventListener('click', () => {
    resetUploadForm();
    navigateHome();
  });

  dom.elTypeBtns.forEach((btn) => btn.addEventListener('click', (e) => {
    dom.elTypeBtns.forEach((b) => { b.classList.remove('btn-primary'); b.classList.add('btn-ghost'); });
    const target = e.currentTarget as HTMLButtonElement;
    target.classList.remove('btn-ghost');
    target.classList.add('btn-primary');
    state.type = target.getAttribute('data-type')!;
    if (state.type === 'series') {
      dom.elSeriesOptions.style.display = 'block';
      dom.elMatchaOptions.style.display = 'none';
    } else if (state.type === 'matcha') {
      dom.elSeriesOptions.style.display = 'none';
      dom.elMatchaOptions.style.display = 'block';
    } else {
      dom.elSeriesOptions.style.display = 'none';
      dom.elMatchaOptions.style.display = 'none';
    }
    syncEpisodeMetadata(state);
    updateMatchaStorageUI(state);
    renderEpisodes(state, dom, episodeRendererOptions);
  }));

  dom.elCatBtns.forEach((btn) => btn.addEventListener('click', (e) => {
    dom.elCatBtns.forEach((b) => { b.classList.remove('btn-primary'); b.classList.add('btn-ghost'); });
    let target = e.currentTarget as HTMLButtonElement | null;
    if (!target || target.tagName.toLowerCase() !== 'button') {
      target = (e.target as HTMLElement).closest('button[data-cat]') as HTMLButtonElement | null;
    }
    if (!target) return;
    target.classList.remove('btn-ghost');
    target.classList.add('btn-primary');
    state.seriesCategory = target.getAttribute('data-cat')!;
    const help = document.getElementById('up-series-help');
    if (help) {
      if (state.seriesCategory === 'tv') {
        help.textContent = 'Series episodik dengan episode per item.';
      } else if (state.seriesCategory === 'movie') {
        help.textContent = 'Series berupa kumpulan film / movie collection dengan satu banner utama.';
      } else {
        help.textContent = 'Series anime dengan episode atau arc yang bisa dikelola per item.';
      }
    }
    syncEpisodeMetadata(state);
    renderEpisodes(state, dom, episodeRendererOptions);
  }));

  dom.elMatchaCatBtns.forEach((btn) => btn.addEventListener('click', (e) => {
    dom.elMatchaCatBtns.forEach((b) => { b.classList.remove('btn-primary'); b.classList.add('btn-ghost'); });
    const target = e.currentTarget as HTMLButtonElement;
    target.classList.remove('btn-ghost');
    target.classList.add('btn-primary');
    state.matchaCategory = target.getAttribute('data-matcha-cat')!;
    updateMatchaStorageUI(state);
  }));

  dom.elHasSeason.addEventListener('change', (e) => {
    state.hasSeason = (e.target as HTMLInputElement).checked;
    dom.elSeasonTabs.style.display = state.hasSeason ? 'flex' : 'none';
    syncEpisodeMetadata(state);
    renderEpisodes(state, dom, episodeRendererOptions);
  });

  dom.elBannerDrop.addEventListener('click', () => {
    if (!state.uploading) dom.elBannerInput.click();
  });
  dom.elBannerInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      state.bannerFile = file;
      if (state.bannerPrev) URL.revokeObjectURL(state.bannerPrev);
      state.bannerPrev = URL.createObjectURL(file);
      dom.elBannerPreview.src = state.bannerPrev;
      dom.elBannerPrevContainer.style.display = 'block';
      dom.elBannerPlaceholder.style.display = 'none';
      dom.elBannerName.textContent = file.name;
      state.lockedBannerUrl = '';
    }
  });

  dom.btnAddSeason.addEventListener('click', () => {
    const nextSeason = state.seasonTabs.length > 0 ? Math.max(...state.seasonTabs) + 1 : 1;
    state.seasonTabs.push(nextSeason);
    state.activeSeasonTab = nextSeason;
    renderSeasons(state, dom, episodeRendererOptions);
    renderEpisodes(state, dom, episodeRendererOptions);
  });
  dom.btnAddEpisode.addEventListener('click', () => {
    state.episodes.push({
      title: '',
      releaseYear: state.type === 'series' ? (state.seriesCategory === 'tv' ? 0 : parseYearInput(dom.elYear.value)) : parseYearInput(dom.elYear.value),
      videoUrl: '',
      storage: '',
      season: state.hasSeason ? state.activeSeasonTab : null,
      posterFile: null,
      posterPreview: '',
      posterUrl: '',
      episodeNumber: null,
    });
    renderEpisodes(state, dom, episodeRendererOptions);
  });

  initializeR2Browser(state, showToast);  // Auto-detect from R2 button handler
  dom.btnAutoDetectR2.addEventListener('click', async () => {
    state.currentPrefix = 'uploads/';
    const searchInput = document.getElementById('r2-search-input') as HTMLInputElement | null;
    if (searchInput) searchInput.value = '';
    (window as any).__setR2AutoDetectMode?.(true);
    (window as any).__refreshEpisodes = () => {
      renderEpisodes(state, dom, episodeRendererOptions);
    };
    await fetchR2Files(state, showToast);
    // Immediately run auto-detect on the current prefix
    const success = await autoDetectVideosFromR2(state, state.currentPrefix, showToast);
    if (success) {
      document.getElementById('r2-browser-modal')?.classList.remove('open');
      renderEpisodes(state, dom, episodeRendererOptions);
    } else {
      // Open modal so user can navigate/select if auto-detect found nothing
      document.getElementById('r2-browser-modal')?.classList.add('open');
    }
  });

  dom.btnSubmit.addEventListener('click', async () => handleSubmit(state, dom, showToast));

  switchUploadTab('info');
  renderSeasons(state, dom, episodeRendererOptions);
  renderEpisodes(state, dom, episodeRendererOptions);
}
