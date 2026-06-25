import { invoke } from '@tauri-apps/api/core';
import { formatBytes, slugify } from './helpers';
import type { UploadState, ToastType } from './types';

export async function fetchByseFiles(state: UploadState, showToast: (msg: string, type?: ToastType) => void) {
  const elLoad = document.getElementById('byse-loading');
  const elList = document.getElementById('byse-list-container');
  const elSearch = document.getElementById('byse-search-input') as HTMLInputElement | null;
  if (!elLoad || !elList) return;
  if (elSearch) elSearch.value = '';

  elLoad.style.display = 'flex';
  elList.style.opacity = '0.4';
  elList.style.pointerEvents = 'none';
  elList.style.transition = 'opacity 0.15s ease';

  const apiUrl = localStorage.getItem('oura_byse_api_url') || 'https://api.byse.sx/file/list';
  const apiKey = localStorage.getItem('oura_byse_api_key') || '';

  if (!apiKey) {
    showToast('Harap setel API Key Byse.sx di menu Settings terlebih dahulu!', 'error');
    elLoad.style.display = 'none';
    elList.style.opacity = '1';
    elList.style.pointerEvents = 'auto';
    document.getElementById('byse-browser-modal')?.classList.remove('open');
    return;
  }

  let cleanUrl = apiUrl.trim();
  if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
  if (cleanUrl.endsWith('/api')) cleanUrl = cleanUrl.slice(0, -4);
  if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);

  let baseApiUrl = cleanUrl;
  if (baseApiUrl.endsWith('/file/list')) {
    baseApiUrl = baseApiUrl.slice(0, -10);
  } else if (baseApiUrl.endsWith('/folder/list')) {
    baseApiUrl = baseApiUrl.slice(0, -12);
  }
  if (baseApiUrl.endsWith('/')) baseApiUrl = baseApiUrl.slice(0, -1);

  const foldersUrl = `${baseApiUrl}/folder/list?key=${apiKey}&fld_id=${state.currentFolderId}`;

  try {
    const foldersRespStr = await invoke<string>('fetch_byse_files_rust', { url: foldersUrl }).catch(() => '{"status": 404}');
    let foldersData: any = {};
    try { foldersData = JSON.parse(foldersRespStr); } catch {}
    const folders = foldersData.result?.folders || foldersData.result || [];

    let allFiles: any[] = [];
    let page = 1;
    let hasMore = true;
    const perPage = 200;

    while (hasMore) {
      const filesUrl = `${baseApiUrl}/file/list?key=${apiKey}&fld_id=${state.currentFolderId}&page=${page}&per_page=${perPage}`;
      const filesRespStr = await invoke<string>('fetch_byse_files_rust', { url: filesUrl }).catch(() => '{"status": 404}');
      let filesData: any = {};
      try { filesData = JSON.parse(filesRespStr); } catch {}
      const files = filesData.result?.files || [];
      if (Array.isArray(files) && files.length > 0) {
        allFiles = allFiles.concat(files);
        if (files.length < perPage) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
      if (page > 30) hasMore = false;
    }

    state.byseFoldersList = (Array.isArray(folders) ? folders : []).sort((a: any, b: any) => {
      const nameA = String(a.name || a.title || '').toLowerCase();
      const nameB = String(b.name || b.title || '').toLowerCase();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

    state.byseFilesList = allFiles.sort((a: any, b: any) => {
      const titleA = String(a.title || '').toLowerCase();
      const titleB = String(b.title || '').toLowerCase();
      return titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: 'base' });
    });

    state.byseFoldersList.forEach((f: any) => {
      const id = String(f.fld_id || f.folder_id || f.id || '');
      const name = String(f.name || f.title || '');
      if (id && name) state.folderNamesCache[id] = name;
    });

    renderByseBrowser(state, fetchByseFiles, showToast);
    document.getElementById('byse-list-container')?.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err: any) {
    console.error(err);
    showToast('Gagal menghubungi API Byse.sx. Cek setelan URL & Internet Anda.', 'error');
  } finally {
    elLoad.style.display = 'none';
    elList.style.opacity = '1';
    elList.style.pointerEvents = 'auto';
  }
}

export function renderByseBrowser(
  state: UploadState,
  fetchByseFiles: (state: UploadState, showToast: (msg: string, type?: ToastType) => void) => Promise<void>,
  showToast: (msg: string, type?: ToastType) => void,
  filteredFolders?: any[],
  filteredFiles?: any[]
) {
  const elList = document.getElementById('byse-list-container');
  const elBreadcrumbs = document.getElementById('byse-breadcrumb-container');
  const elMultiselectBar = document.getElementById('byse-multiselect-bar');
  const elSelectedCount = document.getElementById('byse-selected-count');
  if (!elList || !elBreadcrumbs) return;

  elList.innerHTML = '';
  elBreadcrumbs.innerHTML = '';

  if (state.currentFolderId !== '0') {
    const btnBack = document.createElement('button');
    btnBack.type = 'button';
    btnBack.className = 'btn-small';
    btnBack.style.cssText = 'background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 11px;';
    btnBack.innerHTML = '⬅ Kembali ke Root';
    btnBack.addEventListener('click', () => {
      state.currentFolderId = '0';
      fetchByseFiles(state, showToast);
    });
    elBreadcrumbs.appendChild(btnBack);

    const pathSpan = document.createElement('span');
    pathSpan.style.cssText = 'font-family: var(--font-main); font-size: 12px; color: #fff; margin-left: 8px;';
    pathSpan.textContent = `/ ${state.folderNamesCache[state.currentFolderId] || 'Folder'}`;
    elBreadcrumbs.appendChild(pathSpan);
  } else {
    const rootSpan = document.createElement('span');
    rootSpan.style.cssText = 'font-family: var(--font-main); font-size: 12px; color: var(--text-secondary);';
    rootSpan.textContent = 'Root Folder';
    elBreadcrumbs.appendChild(rootSpan);
  }

  if (elMultiselectBar) {
    if (state.selectedByseFiles.length > 0) {
      elMultiselectBar.style.display = 'flex';
      if (elSelectedCount) elSelectedCount.textContent = String(state.selectedByseFiles.length);
    } else {
      elMultiselectBar.style.display = 'none';
    }
  }

  const foldersToRender = filteredFolders || state.byseFoldersList;
  const filesToRender = filteredFiles || state.byseFilesList;
  state.visibleFiles = filesToRender;

  const btnSelectAll = document.getElementById('btn-byse-select-all') as HTMLButtonElement | null;
  if (btnSelectAll) {
    if (state.visibleFiles.length === 0) {
      btnSelectAll.style.display = 'none';
    } else {
      btnSelectAll.style.display = 'block';
      const allSelected = state.visibleFiles.every((f) => state.selectedByseFiles.some((item) => item.file_code === f.file_code));
      btnSelectAll.textContent = allSelected ? 'Batal Semua' : 'Pilih Semua';
    }
  }

  if (foldersToRender.length === 0 && filesToRender.length === 0) {
    elList.innerHTML = '<p style="padding: 20px; color: #888; text-align:center; font-size: 13px; grid-column: 1 / -1;">Tidak ada file atau folder ditemukan</p>';
    return;
  }

  foldersToRender.forEach((f: any) => {
    const fldId = String(f.fld_id || f.folder_id || f.id || '');
    const fldName = String(f.name || f.title || '');
    const div = document.createElement('div');
    div.className = 'byse-folder-card';
    div.style.cssText = 'padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); cursor: pointer; transition: transform 0.2s, background-color 0.2s; text-align: center;';
    div.innerHTML = `
      <span style="font-size: 32px; margin-bottom: 6px; display: block;">📁</span>
      <span style="font-size: 11px; font-weight: 600; color: #fff; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;" title="${fldName}">${fldName}</span>
    `;
    div.addEventListener('click', () => {
      state.currentFolderId = fldId;
      fetchByseFiles(state, showToast);
    });
    elList.appendChild(div);
  });

  filesToRender.forEach((f: any) => {
    const sizeStr = f.size ? formatBytes(Number(f.size)) : 'Unknown Size';
    const isSelected = state.selectedByseFiles.some((item) => item.file_code === f.file_code);
    const thumbUrl = f.single_img || f.splash_img || f.thumbnail || f.thumbnail_url || f.img || f.screenshot || '';
    const div = document.createElement('div');
    div.className = 'byse-file-card';
    div.style.cssText = 'position: relative; display: flex; flex-direction: column; border-radius: 10px; border: ' + (isSelected ? '2px solid #a4db5c' : '1px solid rgba(255,255,255,0.08)') + '; background: rgba(255,255,255,0.02); overflow: hidden; cursor: pointer; transition: transform 0.2s, border-color 0.2s;';
    const cardHeight = '95px';
    const thumbStyle = thumbUrl
      ? `background: url('${thumbUrl}') center center / cover no-repeat; height: ${cardHeight};`
      : `background: linear-gradient(135deg, #1e2638, #0e121e); height: ${cardHeight}; display: flex; align-items: center; justify-content: center;`;

    div.innerHTML = `
      <div style="position: absolute; top: 6px; left: 6px; z-index: 10; display: flex; align-items: center; justify-content: center;">
        <input type="checkbox" class="byse-file-checkbox" style="width: 16px; height: 16px; accent-color: #a4db5c; cursor: pointer;" ${isSelected ? 'checked' : ''}>
      </div>
      <div style="${thumbStyle} position: relative;">
        ${!thumbUrl ? `<span style="font-size: 24px; opacity: 0.8;">▶</span>` : ''}
        <div style="position: absolute; bottom: 4px; right: 4px; background: rgba(0,0,0,0.7); color: #fff; font-size: 9px; padding: 2px 4px; border-radius: 4px;">${sizeStr}</div>
      </div>
      <div style="padding: 8px; display: flex; flex-direction: column; gap: 4px; flex: 1; justify-content: space-between;">
        <span style="font-size: 11px; font-weight: 600; color: #fff; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;" title="${f.title}">${f.title}</span>
      </div>
    `;

    const toggleSelection = (e: Event) => {
      e.stopPropagation();
      const idx = state.selectedByseFiles.findIndex((item) => item.file_code === f.file_code);
      if (idx > -1) {
        state.selectedByseFiles.splice(idx, 1);
      } else {
        state.selectedByseFiles.push(f);
      }
      renderByseBrowser(state, fetchByseFiles, showToast, filteredFolders, filteredFiles);
    };

    div.addEventListener('click', toggleSelection);
    div.querySelector('.byse-file-checkbox')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const chk = e.target as HTMLInputElement;
      const idx = state.selectedByseFiles.findIndex((item) => item.file_code === f.file_code);
      if (chk.checked && idx === -1) {
        state.selectedByseFiles.push(f);
      } else if (!chk.checked && idx > -1) {
        state.selectedByseFiles.splice(idx, 1);
      }
      renderByseBrowser(state, fetchByseFiles, showToast, filteredFolders, filteredFiles);
    });

    elList.appendChild(div);
  });
}

export function initializeByseBrowser(
  state: UploadState,
  showToast: (msg: string, type?: ToastType) => void,
  renderEpisodes: () => void
) {
  document.getElementById('btn-close-byse')?.addEventListener('click', () => {
    document.getElementById('byse-browser-modal')?.classList.remove('open');
    try { document.getElementById('up-title')?.focus(); } catch (e) { }
  });

  const byseSearchInput = document.getElementById('byse-search-input') as HTMLInputElement | null;
  if (byseSearchInput) {
    byseSearchInput.addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value.trim().toLowerCase();
      if (!q) {
        renderByseBrowser(state, fetchByseFiles, showToast);
      } else {
        const filteredFolders = state.byseFoldersList.filter((f) => {
          const name = String(f.name || f.title || '');
          return name.toLowerCase().includes(q);
        });
        const filteredFiles = state.byseFilesList.filter((f) => {
          const title = String(f.title || '');
          return title.toLowerCase().includes(q);
        });
        renderByseBrowser(state, fetchByseFiles, showToast, filteredFolders, filteredFiles);
      }
    });
  }

  document.getElementById('btn-byse-select-all')?.addEventListener('click', () => {
    const visibleFiles = state.visibleFiles;
    if (!visibleFiles.length) return;
    const allSelected = visibleFiles.every((f) => state.selectedByseFiles.some((item) => item.file_code === f.file_code));
    if (allSelected) {
      state.selectedByseFiles = state.selectedByseFiles.filter((item) => !visibleFiles.some((f) => f.file_code === item.file_code));
    } else {
      visibleFiles.forEach((f) => {
        if (!state.selectedByseFiles.some((item) => item.file_code === f.file_code)) {
          state.selectedByseFiles.push(f);
        }
      });
    }
    const q = byseSearchInput?.value.trim().toLowerCase() || '';
    if (!q) {
      renderByseBrowser(state, fetchByseFiles, showToast);
    } else {
      const filteredFolders = state.byseFoldersList.filter((f) => String(f.name || f.title || '').toLowerCase().includes(q));
      const filteredFiles = state.byseFilesList.filter((f) => String(f.title || '').toLowerCase().includes(q));
      renderByseBrowser(state, fetchByseFiles, showToast, filteredFolders, filteredFiles);
    }
  });

  document.getElementById('btn-byse-select-confirm')?.addEventListener('click', () => {
    if (!state.selectedByseFiles.length) return;
    const apiUrl = localStorage.getItem('oura_byse_api_url') || 'https://api.byse.sx/file/list';
    let domain = 'byse.sx';
    try {
      const urlObj = new URL(apiUrl);
      domain = urlObj.hostname.replace('api.', '');
    } catch {}

    let embedDomain = domain;
    if (embedDomain === 'byse.sx') embedDomain = 'bysebuho.com';

    if (state.activeEpIdx !== null) {
      const first = state.selectedByseFiles[0];
      const firstSlug = slugify(first.title);
      const firstThumb = first.single_img || first.splash_img || first.thumbnail || first.thumbnail_url || first.img || first.screenshot || '';
      state.episodes[state.activeEpIdx].videoUrl = `<iframe src="https://${embedDomain}/e/${first.file_code}/${firstSlug}" frameborder="0" marginwidth="0" marginheight="0" scrolling="no" width="640" height="360" allowfullscreen></iframe>`;
      state.episodes[state.activeEpIdx].storage = 'iframe';
      state.episodes[state.activeEpIdx].posterUrl = firstThumb;
      state.episodes[state.activeEpIdx].posterPreview = firstThumb;
      if (!state.episodes[state.activeEpIdx].title.trim() || state.episodes[state.activeEpIdx].title.startsWith('Episode ') || state.episodes[state.activeEpIdx].title.startsWith('Video ') || state.episodes[state.activeEpIdx].title.startsWith('Movie ')) {
        state.episodes[state.activeEpIdx].title = first.title;
      }
      const baseEp = state.episodes[state.activeEpIdx];
      for (let k = 1; k < state.selectedByseFiles.length; k++) {
        const item = state.selectedByseFiles[k];
        const itemSlug = slugify(item.title);
        const itemThumb = item.single_img || item.splash_img || item.thumbnail || item.thumbnail_url || item.img || item.screenshot || '';
        state.episodes.push({
          title: item.title,
          releaseYear: baseEp.releaseYear,
          videoUrl: `<iframe src="https://${embedDomain}/e/${item.file_code}/${itemSlug}" frameborder="0" marginwidth="0" marginheight="0" scrolling="no" width="640" height="360" allowfullscreen></iframe>`,
          storage: 'iframe',
          season: baseEp.season,
          posterFile: null,
          posterPreview: itemThumb,
          posterUrl: itemThumb,
        });
      }
    } else {
      state.selectedByseFiles.forEach((item) => {
        const itemSlug = slugify(item.title);
        const itemThumb = item.single_img || item.splash_img || item.thumbnail || item.thumbnail_url || item.img || item.screenshot || '';
        state.episodes.push({
          title: item.title,
          releaseYear: state.type === 'series'
            ? (state.seriesCategory === 'tv' ? 0 : Number((document.getElementById('up-year') as HTMLInputElement)?.value || 0))
            : Number((document.getElementById('up-year') as HTMLInputElement)?.value || 0),
          videoUrl: `<iframe src="https://${embedDomain}/e/${item.file_code}/${itemSlug}" frameborder="0" marginwidth="0" marginheight="0" scrolling="no" width="640" height="360" allowfullscreen></iframe>`,
          storage: 'iframe',
          season: state.hasSeason ? state.activeSeasonTab : null,
          posterFile: null,
          posterPreview: itemThumb,
          posterUrl: itemThumb,
        });
      });
    }

    renderEpisodes();
    document.getElementById('byse-browser-modal')?.classList.remove('open');
    try { document.getElementById('up-title')?.focus(); } catch {}
    const count = state.selectedByseFiles.length;
    state.selectedByseFiles = [];
    showToast(`Berhasil memasukkan ${count} file video!`, 'success');
  });
}
