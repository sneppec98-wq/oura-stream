import type { FirestoreFilm } from "../firestore";
import { fetchFilmsByIds } from "../firestore";
import { showToast } from "./dialogs";
import { createMediaCardHTML } from "./ui/CardBuilder";
import { openDetailModal } from "./ui/Modal";
import { quickPlay } from "./library";

const MY_LIST_STORAGE_KEY = "oura_my_list_ids";

export function getMyListIds(): string[] {
  try {
    const data = localStorage.getItem(MY_LIST_STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as string[];
  } catch (err) {
    console.error("Failed to read My List ids:", err);
    return [];
  }
}

export function saveMyListIds(ids: string[]) {
  try {
    localStorage.setItem(MY_LIST_STORAGE_KEY, JSON.stringify(ids));
  } catch (err) {
    console.error("Failed to save My List ids:", err);
  }
}

export function isInMyList(id: string): boolean {
  return getMyListIds().includes(id);
}

export function toggleMyListId(id: string): boolean {
  const ids = getMyListIds();
  const hasItem = ids.includes(id);
  const nextIds = hasItem ? ids.filter((item) => item !== id) : [...ids, id];
  saveMyListIds(nextIds);
  return !hasItem;
}

export function attachCollectionCardEvents(items: FirestoreFilm[]) {
  document.querySelectorAll<HTMLDivElement>(".media-card").forEach(card => {
    const video = card.querySelector<HTMLVideoElement>(".card-video-preview");
    if (video) {
      card.addEventListener("mouseenter", () => {
        video.play().catch(err => {
          console.debug("Video preview play failed/interrupted:", err);
        });
      });
      card.addEventListener("mouseleave", () => {
        video.pause();
        video.currentTime = 0;
      });
    }

    card.addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;
      const playBtn = target.closest(".card-play-btn, .card-play-btn-circle") as HTMLElement | null;
      const id = card.dataset.id!;
      let film: FirestoreFilm | null = items.find(f => f.id === id) || null;

      if (!film) {
        try {
          const fetched = await fetchFilmsByIds([id]);
          if (fetched && fetched.length > 0) {
            film = fetched[0];
          }
        } catch (err) {
          console.error("Failed to fetch film on My List card click:", err);
        }
      }

      if (film) {
        if (playBtn) {
          quickPlay(film);
        } else {
          openDetailModal(film);
        }
      }
    });
  });
}

export async function renderMyListView() {
  const grid = document.getElementById("mylist-items-grid");
  const emptyState = document.getElementById("mylist-empty-state");
  const loading = document.getElementById("mylist-loading");

  if (!grid || !emptyState || !loading) return;

  const ids = getMyListIds();
  loading.style.display = "flex";
  grid.innerHTML = "";
  emptyState.style.display = "none";

  if (ids.length === 0) {
    loading.style.display = "none";
    emptyState.style.display = "flex";
    emptyState.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 38px; line-height: 1;">💖</div>
        <div>
          <h3 style="margin: 0; font-size: 18px; color: #fff;">Daftar favorit Anda kosong</h3>
          <p style="margin: 8px 0 0; color: var(--text-secondary); font-size: 13px; max-width: 540px; line-height: 1.6;">
            Tambahkan film atau series ke My List dari detail konten, lalu kembali ke halaman ini untuk melihat koleksi favorit Anda.
          </p>
        </div>
      </div>`;
    return;
  }

  try {
    const items = await fetchFilmsByIds(ids);
    loading.style.display = "none";

    if (!items || items.length === 0) {
      emptyState.style.display = "flex";
      emptyState.innerHTML = `
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="font-size: 38px; line-height: 1;">💖</div>
          <div>
            <h3 style="margin: 0; font-size: 18px; color: #fff;">Daftar favorit Anda kosong</h3>
            <p style="margin: 8px 0 0; color: var(--text-secondary); font-size: 13px; max-width: 540px; line-height: 1.6;">
              Film favorit Anda belum tersedia atau belum ditambahkan.
            </p>
          </div>
        </div>`;
      return;
    }

    grid.innerHTML = items.map(f => createMediaCardHTML(f)).join("");
    attachCollectionCardEvents(items);
  } catch (err) {
    loading.style.display = "none";
    emptyState.style.display = "flex";
    emptyState.innerHTML = `
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 38px; line-height: 1;">⚠️</div>
        <div>
          <h3 style="margin: 0; font-size: 18px; color: #fff;">Gagal memuat My List</h3>
          <p style="margin: 8px 0 0; color: var(--text-secondary); font-size: 13px; max-width: 540px; line-height: 1.6;">
            Terjadi masalah saat mengambil daftar favorit Anda. Coba lagi nanti.
          </p>
        </div>
      </div>`;
    showToast("Gagal memuat My List.", "error");
  }
}
