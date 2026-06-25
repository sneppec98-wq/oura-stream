import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { FirestoreFilm } from '../firestore';
import { showToast } from './dialogs';
import { switchView } from './library';

export interface DraftFilm extends FirestoreFilm {
  status: 'draft' | 'published';
}

export async function loadDrafts(): Promise<DraftFilm[]> {
  try {
    const user = auth.currentUser;
    if (!user) return [];

    const filmsRef = collection(db, 'films');
    const matchaRef = collection(db, 'matcha');

    const filmsQuery = query(filmsRef, where('status', '==', 'draft'));
    const matchaQuery = query(matchaRef, where('status', '==', 'draft'));

    const [filmsSnapshot, matchaSnapshot] = await Promise.all([
      getDocs(filmsQuery),
      getDocs(matchaQuery),
    ]);

    const drafts: DraftFilm[] = [];
    filmsSnapshot.forEach((docSnap) => {
      const data = docSnap.data() as DraftFilm;
      data.id = docSnap.id;
      drafts.push(data);
    });
    matchaSnapshot.forEach((docSnap) => {
      const data = docSnap.data() as DraftFilm;
      data.id = docSnap.id;
      drafts.push(data);
    });

    return drafts.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
  } catch (err) {
    console.error('Failed to load drafts:', err);
    return [];
  }
}

export async function publishDraft(filmId: string, collection: string): Promise<boolean> {
  try {
    const filmDoc = doc(db, collection, filmId);
    await updateDoc(filmDoc, { status: 'published', updatedAt: new Date().toISOString() });
    showToast('Draft berhasil dipublikasikan!', 'success');
    return true;
  } catch (err) {
    console.error('Failed to publish draft:', err);
    showToast('Gagal mempublikasikan draft', 'error');
    return false;
  }
}

export async function deleteDraft(filmId: string, collection: string): Promise<boolean> {
  try {
    const filmDoc = doc(db, collection, filmId);
    await deleteDoc(filmDoc);
    showToast('Draft berhasil dihapus!', 'success');
    return true;
  } catch (err) {
    console.error('Failed to delete draft:', err);
    showToast('Gagal menghapus draft', 'error');
    return false;
  }
}

export function renderDraftsView(drafts: DraftFilm[]): string {
  if (drafts.length === 0) {
    return `
      <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
        <div style="font-size: 48px; margin-bottom: 12px;">📋</div>
        <p style="font-size: 14px; font-weight: 600;">Tidak ada draft</p>
        <p style="font-size: 13px; margin-top: 8px;">Mulai upload konten dan pilih "Simpan Sebagai Draft" untuk menyimpannya di sini.</p>
      </div>
    `;
  }

  const draftsHTML = drafts.map((draft) => {
    const bannerUrl = draft.bannerUrl || '/src/assets/placeholder.jpg';
    const type = draft.type === 'matcha' ? 'Matcha' : draft.type === 'series' ? 'Series' : 'Film';
    const rawDate = draft.updatedAt || draft.createdAt;
    let parsedDate: Date;
    if (rawDate && typeof rawDate === 'object' && rawDate.seconds !== undefined) {
      parsedDate = new Date(rawDate.seconds * 1000);
    } else if (rawDate && typeof rawDate.toDate === 'function') {
      parsedDate = rawDate.toDate();
    } else if (rawDate) {
      parsedDate = new Date(rawDate);
    } else {
      parsedDate = new Date();
    }
    const updatedDate = isNaN(parsedDate.getTime())
      ? 'Tanggal tidak valid'
      : parsedDate.toLocaleDateString('id-ID', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

    return `
      <article class="draft-card">
        <div class="draft-poster-wrap">
          <img class="draft-poster" src="${bannerUrl}" alt="${draft.title}" />
        </div>
        <div class="draft-body">
          <header class="draft-header">
            <h3 class="draft-title">${draft.title}</h3>
            <span class="draft-badge">📋 ${type}</span>
          </header>

          <div class="draft-meta">
            <span>Tahun: <strong>${draft.releaseYear || '-'}</strong></span>
            <span>Rating: <strong>${draft.rating || '-'}/10</strong></span>
            <span>Episode: <strong>${draft.episodes?.length || 0}</strong></span>
          </div>

          <p class="draft-updated">Diperbarui: ${updatedDate}</p>

          <div class="draft-actions">
            <button class="btn btn-ghost edit-draft-btn" data-film-id="${draft.id}" data-collection="${draft.type === 'matcha' ? 'matcha' : 'films'}">✎ Edit</button>
            <button class="btn btn-ghost publish-draft-btn" data-film-id="${draft.id}" data-collection="${draft.type === 'matcha' ? 'matcha' : 'films'}">✓ Publikasikan</button>
            <button class="btn btn-ghost delete-draft-btn" data-film-id="${draft.id}" data-collection="${draft.type === 'matcha' ? 'matcha' : 'films'}">🗑 Hapus</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  return `
    <div class="drafts-grid-wrapper">
      <div class="drafts-grid">
        ${draftsHTML}
      </div>
    </div>
  `;
}

export function initializeDraftsView() {
  const container = document.getElementById('drafts-container');
  if (!container) return;

  // Initialize column toggle button
  const toggleBtn = document.getElementById('btn-drafts-toggle-cols');
  const applyCols = (cols: 'cols-3' | 'cols-4') => {
    const grid = container.querySelector('.drafts-grid') as HTMLElement | null;
    if (!grid) return;
    grid.classList.remove('cols-3', 'cols-4');
    grid.classList.add(cols);
    if (toggleBtn) toggleBtn.textContent = cols === 'cols-3' ? '3 Kolom' : '4 Kolom';
    localStorage.setItem('oura_drafts_cols', cols);
  };

  // Restore preference
  const saved = (localStorage.getItem('oura_drafts_cols') as 'cols-3' | 'cols-4' | null) || 'cols-3';
  applyCols(saved);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = (localStorage.getItem('oura_drafts_cols') as 'cols-3' | 'cols-4' | null) || 'cols-3';
      const next = current === 'cols-3' ? 'cols-4' : 'cols-3';
      applyCols(next);
    });
  }

  // We use onclick to avoid duplicate listeners on refresh
  container.onclick = async (e) => {
    const target = (e.target as HTMLElement).closest('button');
    if (!target) return;

    if (target.classList.contains('publish-draft-btn')) {
      const filmId = target.getAttribute('data-film-id');
      const collection = target.getAttribute('data-collection');
      if (filmId && collection) {
        const success = await publishDraft(filmId, collection);
        if (success) {
          const draftCard = target.closest('.draft-card') as HTMLElement;
          if (draftCard) {
            draftCard.style.setProperty('opacity', '0.5');
            draftCard.style.setProperty('pointer-events', 'none');
            setTimeout(() => {
              draftCard.remove();
              const remaining = container.querySelectorAll('.draft-card').length;
              if (remaining === 0) {
                refreshDraftsView();
              }
            }, 1500);
          }
        }
      }
    }

    if (target.classList.contains('delete-draft-btn')) {
      const filmId = target.getAttribute('data-film-id');
      const collection = target.getAttribute('data-collection');
      if (filmId && collection) {
        if (confirm('Yakin ingin menghapus draft ini?')) {
          const success = await deleteDraft(filmId, collection);
          if (success) {
            const draftCard = target.closest('.draft-card') as HTMLElement;
            if (draftCard) {
              draftCard.style.setProperty('opacity', '0.5');
              draftCard.style.setProperty('pointer-events', 'none');
              setTimeout(() => {
                draftCard.remove();
                const remaining = container.querySelectorAll('.draft-card').length;
                if (remaining === 0) {
                  refreshDraftsView();
                }
              }, 1500);
            }
          }
        }
      }
    }

    if (target.classList.contains('edit-draft-btn')) {
      const filmId = target.getAttribute('data-film-id');
      if (filmId) {
        const drafts = Array.from(container.querySelectorAll('.draft-card')).map((card: any) => {
          const filmIdAttr = card.querySelector('.edit-draft-btn')?.getAttribute('data-film-id');
          return { id: filmIdAttr };
        });
        const draft = drafts.find((d: any) => d.id === filmId);
        if (draft && (window as any).startEditingFilm) {
          // Load full draft data and start editing
          const allDrafts = (window as any).__draftsList || [];
          const fullDraft = allDrafts.find((d: any) => d.id === filmId);
          if (fullDraft) {
            (window as any).startEditingFilm(fullDraft);
            switchView('view-upload', 'nav-downloads');
          }
        }
      }
    }
  };
}

export async function refreshDraftsView() {
  const container = document.getElementById('drafts-container');
  if (!container) return;

  const drafts = await loadDrafts();
  (window as any).__draftsList = drafts;
  container.innerHTML = renderDraftsView(drafts);
  initializeDraftsView();
}
