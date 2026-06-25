import type { WatchProgress } from "./types";
import type { FirestoreFilm, FirestoreEpisode } from "../firestore";

export function getWatchProgress(filmId: string, epId: string): WatchProgress | null {
  try {
    const key = `oura_progress_${filmId}_ep${epId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

export function saveWatchProgress(filmId: string, epId: string, prog: WatchProgress) {
  try {
    localStorage.setItem(`oura_progress_${filmId}_ep${epId}`, JSON.stringify(prog));
  } catch (err) { console.error("Save progress error:", err); }
}

export function deleteWatchProgress(filmId: string, epId: string) {
  try { localStorage.removeItem(`oura_progress_${filmId}_ep${epId}`); } catch {}
}

export function getFilmProgress(film: FirestoreFilm): { ep: FirestoreEpisode; progress: WatchProgress } | null {
  // Cari episode terakhir yang punya progress
  let latest: { ep: FirestoreEpisode; progress: WatchProgress } | null = null;
  const eps = film.episodes || [];
  for (const ep of eps) {
    const prog = getWatchProgress(film.id, ep.id);
    if (prog && (!latest || prog.timestamp > latest.progress.timestamp)) {
      latest = { ep, progress: prog };
    }
  }
  return latest;
}
