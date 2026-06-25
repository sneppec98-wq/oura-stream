import { formatBytes } from './helpers';
import type { UploadState, ToastType } from './types';

const R2_WORKER = (import.meta as any).env?.VITE_R2_WORKER_URL || '';
const AUTH_SECRET = (import.meta as any).env?.VITE_R2_AUTH_SECRET || '';
const VIDEO_EXTENSIONS = /\.(mp4|mkv|avi|mov|webm|3gp|flv|m3u8|ts|mts|m2ts)$/i;

function parseYearInput(input: string): number {
  if (!input || input === '0') return 0;
  const match = input.match(/(\d{4})/);
  return match ? parseInt(match[1]) : 0;
}

export async function autoDetectVideosFromR2(state: UploadState, folderPrefix: string, showToast: (msg: string, type?: ToastType) => void) {
  try {
    const resp = await fetch(`${R2_WORKER}/list?prefix=${folderPrefix}&delimiter=/`, {
      headers: { 'X-Auth-Token': AUTH_SECRET },
    });
    const data = await resp.json();
    const objects = data.objects || [];
    
    const videoFiles = objects.filter((o: any) => VIDEO_EXTENSIONS.test(o.key));
    
    if (videoFiles.length === 0) {
      showToast('Tidak ada file video ditemukan di folder ini', 'info');
      return false;
    }

    // Clear existing episodes
    state.episodes = [];

    // Add each video as an episode
    videoFiles.forEach((video: any, index: number) => {
      const fileName = video.key.split('/').pop() || `Video ${index + 1}`;
      const title = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
      
      state.episodes.push({
        title: title,
        releaseYear: parseYearInput((document.getElementById('up-year') as HTMLInputElement)?.value || '0'),
        videoUrl: video.publicUrl,
        storage: 'r2',
        season: state.hasSeason ? state.activeSeasonTab : null,
        posterFile: null,
        posterPreview: '',
        posterUrl: '',
        episodeNumber: index + 1,
      });
    });

    showToast(`✓ Auto-detect berhasil! Ditemukan ${videoFiles.length} video`, 'success');
    return true;
  } catch (err) {
    console.error('Auto-detect error:', err);
    showToast('Gagal auto-detect video dari R2', 'error');
    return false;
  }
}

export async function fetchR2Files(state: UploadState, showToast: (msg: string, type?: ToastType) => void) {
  const elLoad = document.getElementById('r2-loading');
  const elList = document.getElementById('r2-list-container');
  const elPrefix = document.getElementById('r2-current-prefix');
  const elBack = document.getElementById('r2-btn-back');
  if (!elLoad || !elList || !elPrefix || !elBack) return;

  elLoad.style.display = 'flex';
  elList.innerHTML = '';
  state.currentPrefix = state.currentPrefix || 'uploads/';
  elPrefix.textContent = state.currentPrefix;
  elBack.style.display = state.currentPrefix !== 'uploads/' ? 'flex' : 'none';

  try {
    const resp = await fetch(`${R2_WORKER}/list?prefix=${state.currentPrefix}&delimiter=/`, {
      headers: { 'X-Auth-Token': AUTH_SECRET },
    });
    const data = await resp.json();
    state.r2Files = { objects: data.objects || [], folders: data.folders || [] };

    renderR2ListItems(state, showToast);
  } catch (err) {
    showToast('Gagal mengambil daftar file R2', 'error');
  } finally {
    elLoad.style.display = 'none';
  }
}

export function renderR2ListItems(state: UploadState, showToast: (msg: string, type?: ToastType) => void) {
  const elList = document.getElementById('r2-list-container');
  if (!elList) return;
  elList.innerHTML = '';

  const searchInput = document.getElementById('r2-search-input') as HTMLInputElement | null;
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  // Filter folders
  const filteredFolders = state.r2Files.folders.filter((f: string) => {
    const name = f.replace(state.currentPrefix, '').toLowerCase();
    return name.includes(query);
  });

  // Filter objects
  const filteredObjects = state.r2Files.objects.filter((o: any) => {
    const name = o.key.replace(state.currentPrefix, '').toLowerCase();
    return name.includes(query);
  });

  filteredFolders.forEach((f: string) => {
    const div = document.createElement('div');
    div.className = 'r2-item folder-item';
    div.style.borderLeft = '3px solid #00acee';
    div.innerHTML = `<div class="r2-info"><span class="r2-key">📁 ${f.replace(state.currentPrefix, '')}</span></div><span class="r2-meta">Folder</span>`;
    div.onclick = async () => {
      if (searchInput) searchInput.value = '';
      state.currentPrefix = f;
      await fetchR2Files(state, showToast);
      if ((window as any).__r2AutoDetectMode) {
        const success = await autoDetectVideosFromR2(state, state.currentPrefix, showToast);
        if (success) {
          document.getElementById('r2-browser-modal')?.classList.remove('open');
          const refreshFunc = (window as any).__refreshEpisodes;
          if (refreshFunc) refreshFunc();
        }
      }
    };
    elList.appendChild(div);
  });

  filteredObjects.forEach((o: any) => {
    if (o.key === state.currentPrefix) return;
    const div = document.createElement('div');
    div.className = 'r2-item';
    div.innerHTML = `<div class="r2-info"><span class="r2-key">📄 ${o.key.replace(state.currentPrefix, '')}</span><span class="r2-meta">${formatBytes(o.size)}</span></div><button class="btn-select" style="background:var(--accent-primary);color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;">Pilih</button>`;
    div.onclick = () => {
      if (state.activeEpIdx !== null) {
        state.episodes[state.activeEpIdx].videoUrl = o.publicUrl;
        state.episodes[state.activeEpIdx].storage = 'r2';
        state.activeEpIdx = state.activeEpIdx;
        document.getElementById('r2-browser-modal')?.classList.remove('open');
      }
    };
    elList.appendChild(div);
  });

  if (!filteredFolders.length && !filteredObjects.length) {
    elList.innerHTML = '<p style="padding: 20px; color: #555; text-align:center;">Kosong / Tidak ditemukan</p>';
  }
}

export function initializeR2Browser(state: UploadState, showToast: (msg: string, type?: ToastType) => void) {
  let isAutoDetectMode = false;

  const searchInput = document.getElementById('r2-search-input') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderR2ListItems(state, showToast);
    });
  }

  document.getElementById('r2-btn-back')?.addEventListener('click', () => {
    const parts = state.currentPrefix.split('/').filter(Boolean);
    if (parts.length <= 1) return;
    parts.pop();
    state.currentPrefix = parts.join('/') + '/';
    if (searchInput) searchInput.value = '';
    fetchR2Files(state, showToast);
  });

  document.getElementById('btn-close-r2')?.addEventListener('click', () => {
    document.getElementById('r2-browser-modal')?.classList.remove('open');
    isAutoDetectMode = false;
  });

  document.getElementById('btn-r2-auto-detect')?.addEventListener('click', async () => {
    if (isAutoDetectMode) {
      const success = await autoDetectVideosFromR2(state, state.currentPrefix, showToast);
      if (success) {
        document.getElementById('r2-browser-modal')?.classList.remove('open');
        // Refresh episodes list in main upload view
        const refreshFunc = (window as any).__refreshEpisodes;
        if (refreshFunc) refreshFunc();
      }
    }
  });

  // Store global reference for setting auto-detect mode
  (window as any).__setR2AutoDetectMode = (mode: boolean) => {
    isAutoDetectMode = mode;
    (window as any).__r2AutoDetectMode = !!mode;
    const btn = document.getElementById('btn-r2-auto-detect');
    if (btn) {
      btn.style.display = isAutoDetectMode ? 'block' : 'none';
    }
  };
}
