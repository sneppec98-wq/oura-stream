import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { parseYearInput, resizeImage, slugify } from './helpers';
import type { UploadState, ToastType } from './types';
import type { UploadDomRefs } from './dom';
import { appState } from '../main/state';

function updateSubmitButtonText(button: HTMLButtonElement, text: string) {
  const span = button.querySelector('span');
  if (span) {
    span.textContent = text;
  } else {
    button.textContent = text;
  }
}

async function processMatchaUpload(state: UploadState, dom: UploadDomRefs, showToast: (msg: string, type?: ToastType) => void) {
  const isMatchaStorage = state.type === 'matcha' && (document.getElementById('up-matcha-storage') as HTMLInputElement)?.checked && !state.editingFilmId;
  if (!isMatchaStorage) return false;

  const isDraft = state.uploadStatus === 'draft';
  if (!isDraft && state.episodes.length === 0) {
    showToast('Minimal harus ada satu video/episode.', 'error');
    return true;
  }

  if (!isDraft) {
    for (const ep of state.episodes) {
      if (!ep.videoUrl.trim()) {
        showToast('Semua kolom video URL harus diisi.', 'error');
        return true;
      }
    }
  }

  // Duplicate Check
  for (const ep of state.episodes) {
    if (!ep.videoUrl || !ep.videoUrl.trim()) continue;
    const url = ep.videoUrl.trim();
    const duplicate = appState.currentLibraryItems.find(f => 
      f.id !== state.editingFilmId && 
      f.episodes?.some(e => e.videoUrl?.trim() === url)
    );
    if (duplicate) {
      showToast(`Peringatan: Video URL sudah ada di koleksi "${duplicate.title}". Hindari duplikasi!`, 'error');
      return true;
    }
  }

  state.uploading = true;
  dom.btnSubmit.textContent = 'Sedang Memproses...';
  dom.btnSubmit.disabled = true;

  try {
    const userEmail = auth.currentUser?.email || 'admin';

    if (state.episodes.length === 0) {
      const filmSlug = slugify(dom.elTitle.value.trim() || `Matcha ${Date.now()}`);
      const filmId = `${filmSlug}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const payload = {
        id: filmId,
        title: dom.elTitle.value.trim() || `Matcha #${Math.floor(1000 + Math.random() * 9000)}`,
        slug: filmSlug,
        type: 'matcha',
        seriesCategory: null,
        matchaCategory: state.matchaCategory,
        hasSeason: false,
        releaseYear: parseYearInput(dom.elYear.value) as number,
        country: dom.elCountry.value || '',
        rating: parseFloat(dom.elRating.value) || 0,
        bannerUrl: state.lockedBannerUrl || '',
        uploadedBy: userEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        episodes: [],
        status: state.uploadStatus,
      };
      updateSubmitButtonText(dom.btnSubmit, 'Menyimpan draft...');
      await setDoc(doc(db, 'matcha', payload.id), payload);
    } else {
      for (let i = 0; i < state.episodes.length; i++) {
        const ep = state.episodes[i];
        const isDirect = !!ep.videoUrl?.match(/\.(mp4|mkv|webm|avi|m3u8|mov|3gp|flv)(\?.*)?$/i);
        if (ep.videoUrl.includes('drive.google.com')) ep.storage = 'gdrive';
        else if (isDirect) ep.storage = 'r2';
        else ep.storage = '';

        let title = ep.title.trim();
        if (!title) {
          title = `Secret Matcha #${Math.floor(1000 + Math.random() * 9000)}`;
        }

        const filmSlug = slugify(title);
        const filmId = `${filmSlug}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const finalEp = {
          id: `ep_0_${filmId}`,
          title: 'Main Video',
          season: null,
          releaseYear: parseYearInput(String(ep.releaseYear)) as number,
          videoUrl: ep.videoUrl,
          storage: ep.storage,
          posterUrl: ep.posterUrl || '',
          episodeNumber: 1,
        };

        const payload = {
          id: filmId,
          title,
          slug: filmSlug,
          type: 'matcha',
          seriesCategory: null,
          matchaCategory: state.matchaCategory,
          hasSeason: false,
          releaseYear: finalEp.releaseYear,
          country: dom.elCountry.value || '',
          rating: parseFloat(dom.elRating.value) || 0,
          bannerUrl: ep.posterUrl || '',
          uploadedBy: userEmail,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          episodes: [finalEp],
          status: state.uploadStatus,
        };

        updateSubmitButtonText(dom.btnSubmit, `Mengunggah (${i + 1}/${state.episodes.length})...`);
        await setDoc(doc(db, 'matcha', payload.id), payload);
      }
    }

    showToast('Semua video berhasil disimpan ke Storage Matcha!', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (err: any) {
    dom.elSubmitError.textContent = 'Gagal menyimpan: ' + err.message;
    dom.elSubmitError.style.display = 'block';
  } finally {
    state.uploading = false;
    updateSubmitButtonText(dom.btnSubmit, 'Publikasikan Konten');
    dom.btnSubmit.disabled = false;
  }

  return true;
}

export async function handleSubmit(
  state: UploadState,
  dom: UploadDomRefs,
  showToast: (msg: string, type?: ToastType) => void
) {
  dom.elSubmitError.style.display = 'none';

  const handledMatcha = await processMatchaUpload(state, dom, showToast);
  if (handledMatcha) return;

  let finalTitle = dom.elTitle.value.trim();
  if (!finalTitle) {
    if (state.type === 'matcha') {
      finalTitle = `Matcha #${Math.floor(1000 + Math.random() * 9000)}`;
    } else {
      showToast('Judul film/series harus diisi.', 'error');
      return;
    }
  }

  const isDraft = state.uploadStatus === 'draft';
  if (!isDraft && state.episodes.length === 0) {
    showToast('Minimal harus ada satu video/episode.', 'error');
    return;
  }

  if (!isDraft) {
    for (const ep of state.episodes) {
      if (!ep.videoUrl.trim()) {
        showToast('Semua kolom video URL harus diisi.', 'error');
        return;
      }
    }
  }

  // Duplicate Check
  for (const ep of state.episodes) {
    if (!ep.videoUrl || !ep.videoUrl.trim()) continue;
    const url = ep.videoUrl.trim();
    const duplicate = appState.currentLibraryItems.find(f => 
      f.id !== state.editingFilmId && 
      f.episodes?.some(e => e.videoUrl?.trim() === url)
    );
    if (duplicate) {
      showToast(`Peringatan: Video URL sudah ada di koleksi "${duplicate.title}". Hindari duplikasi!`, 'error');
      return;
    }
  }

  state.uploading = true;
  updateSubmitButtonText(dom.btnSubmit, 'Sedang Memproses...');
  dom.btnSubmit.disabled = true;

  try {
    const filmSlug = slugify(finalTitle);
    let bannerUrl = state.lockedBannerUrl;

    // Ensure R2 folder exists: call Worker /create-folder
    try {
      const workerUrl = (import.meta as any).env?.VITE_R2_WORKER_URL || '';
      const authSecret = (import.meta as any).env?.VITE_R2_AUTH_SECRET || '';
      if (workerUrl) {
        updateSubmitButtonText(dom.btnSubmit, 'Membuat folder di R2...');
        await fetch(`${workerUrl}/create-folder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': authSecret
          },
          body: JSON.stringify({ prefix: `uploads/${filmSlug}/` })
        });
      }
    } catch (e) {
      console.warn('Gagal membuat folder di R2:', e);
    }

    if (state.bannerFile && !state.lockedBannerUrl) {
      // Upload banner to R2 via presign endpoint on Worker
      try {
        const workerUrl = (import.meta as any).env?.VITE_R2_WORKER_URL || '';
        const authSecret = (import.meta as any).env?.VITE_R2_AUTH_SECRET || '';
        const ext = (state.bannerFile.name || 'banner.jpg').split('.').pop() || 'jpg';
        const key = `uploads/${filmSlug}/banner.${ext}`;

        if (workerUrl) {
          updateSubmitButtonText(dom.btnSubmit, 'Mempersiapkan upload banner...');
          const presignResp = await fetch(`${workerUrl}/presign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Auth-Token': authSecret },
            body: JSON.stringify({ key })
          });
          const presignData = await presignResp.json();
          if (presignData && presignData.uploadUrl) {
            updateSubmitButtonText(dom.btnSubmit, 'Mengunggah banner ke R2...');
            await fetch(presignData.uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': state.bannerFile.type || 'application/octet-stream' },
              body: state.bannerFile
            });
            bannerUrl = presignData.publicUrl || `${(import.meta as any).env?.VITE_R2_PUBLIC_URL || ''}/${key}`;
          } else {
            // fallback to resized dataURL if presign failed
            updateSubmitButtonText(dom.btnSubmit, 'Mengompres banner...');
            bannerUrl = await resizeImage(state.bannerFile, 300, 450);
          }
        } else {
          updateSubmitButtonText(dom.btnSubmit, 'Mengompres banner...');
          bannerUrl = await resizeImage(state.bannerFile, 300, 450);
        }
      } catch (err) {
        console.warn('Banner upload failed, using resized data URL', err);
        updateSubmitButtonText(dom.btnSubmit, 'Mengompres banner...');
        bannerUrl = await resizeImage(state.bannerFile, 300, 450);
      }
    }

    for (let i = 0; i < state.episodes.length; i++) {
      const ep = state.episodes[i];
      if (ep.posterFile && state.seriesCategory === 'movie') {
        updateSubmitButtonText(dom.btnSubmit, `Mengompres poster video ${i + 1}...`);
        ep.posterUrl = await resizeImage(ep.posterFile, 300, 450);
      }

      const isDirect = !!ep.videoUrl?.match(/\.(mp4|mkv|webm|avi|m3u8|mov|3gp|flv)(\?.*)?$/i);
      if (ep.videoUrl?.includes('drive.google.com')) ep.storage = 'gdrive';
      else if (isDirect) ep.storage = 'r2';
      else ep.storage = ep.videoUrl.trim() ? 'iframe' : '';
    }

    const seasonCounters: { [key: string]: number } = {};
    const finalEpisodes = state.episodes.map((ep) => {
      let epIndex = 1;
      if (ep.episodeNumber !== undefined && ep.episodeNumber !== null) {
        epIndex = Number(ep.episodeNumber);
      } else if (state.hasSeason) {
        const sVal = String(ep.season || state.activeSeasonTab);
        seasonCounters[sVal] = (seasonCounters[sVal] || 0) + 1;
        epIndex = seasonCounters[sVal];
      } else {
        seasonCounters.no_season = (seasonCounters.no_season || 0) + 1;
        epIndex = seasonCounters.no_season;
      }

      const isMovieSeries = state.type === 'series' && state.seriesCategory === 'movie';
      const fallbackTitle = state.type === 'film'
        ? 'Main Video'
        : isMovieSeries
        ? `Movie ${epIndex}`
        : `Episode ${epIndex}`;

      return {
        id: ep.id || `ep_${epIndex}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: ep.title || fallbackTitle,
        season: state.hasSeason ? Number(ep.season || state.activeSeasonTab) : null,
        releaseYear: parseYearInput(String(ep.releaseYear)) as number,
        videoUrl: ep.videoUrl,
        storage: ep.storage,
        posterUrl: ep.posterUrl || '',
        episodeNumber: epIndex,
      };
    });

    const payloadId = state.editingFilmId || `${filmSlug}_${Date.now()}`;
    const payloadCreatedAt = state.editingFilmCreatedAt || new Date().toISOString();
    const payloadUploadedBy = state.editingFilmUploadedBy || auth.currentUser?.email || 'admin';

    const payload = {
      id: payloadId,
      title: finalTitle,
      slug: filmSlug,
      type: state.type,
      seriesCategory: state.type === 'series' ? state.seriesCategory : null,
      matchaCategory: state.type === 'matcha' ? state.matchaCategory : null,
      hasSeason: state.type === 'series' ? state.hasSeason : false,
      releaseYear: parseYearInput(dom.elYear.value) as number,
      country: dom.elCountry.value,
      rating: parseFloat(dom.elRating.value) || 0,
      bannerUrl: bannerUrl || finalEpisodes[0]?.posterUrl || '',
      uploadedBy: payloadUploadedBy,
      createdAt: payloadCreatedAt,
      updatedAt: new Date().toISOString(),
      episodes: finalEpisodes,
      status: state.uploadStatus,
    };

    const targetCollection = state.type === 'matcha' ? 'matcha' : 'films';
    await setDoc(doc(db, targetCollection, payload.id), payload);

    if (state.editingFilmId) {
      showToast('Konten berhasil diperbarui!', 'success');
    } else if (state.uploadStatus === 'draft') {
      showToast('Konten berhasil disimpan sebagai draft!', 'success');
    } else {
      showToast('Konten berhasil diterbitkan ke Firestore!', 'success');
    }
    setTimeout(() => window.location.reload(), 1500);
  } catch (err: any) {
    dom.elSubmitError.textContent = 'Gagal menyimpan: ' + err.message;
    dom.elSubmitError.style.display = 'block';
  } finally {
    state.uploading = false;
    updateSubmitButtonText(dom.btnSubmit, state.editingFilmId ? 'Simpan Perubahan' : 'Publikasikan Konten');
    dom.btnSubmit.disabled = false;
  }
}

