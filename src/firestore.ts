import { db, auth } from "./firebase";
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

// ─── TYPES (sesuai struktur Firestore dari Oura/) ─────────────────────────────

export interface FirestoreEpisode {
  id: string;
  title: string;
  season: number | null;
  releaseYear: string | number;
  videoUrl: string;
  storage: "iframe" | "gdrive" | "r2";
  posterUrl?: string;
  episodeNumber?: number;
}

export interface FirestoreFilm {
  id: string;
  title: string;
  slug: string;
  type: "film" | "series" | "matcha";
  seriesCategory: "tv" | "movie" | "anime" | null;
  hasSeason: boolean;
  releaseYear: string | number;
  country: string;
  bannerUrl: string;
  status: "draft" | "published";
  uploadedBy: string;
  updatedAt: any;
  createdAt: any;
  episodes: FirestoreEpisode[];
  videoUrl?: string;
  storage?: string;
  rating?: number;
}

export function parseDocDataToFilm(id: string, rawData: any): FirestoreFilm {
  const data = { id, ...rawData };
  
  // Normalize legacy films having videoUrl/storage at root level
  if (data.type === "film" && (!data.episodes || data.episodes.length === 0) && data.videoUrl) {
    data.episodes = [{
      id: `ep_0_${id}`,
      title: "Main Video",
      videoUrl: data.videoUrl,
      storage: data.storage || "iframe",
      season: null,
      releaseYear: typeof data.releaseYear === 'number' ? data.releaseYear : parseInt(data.releaseYear) || 0,
      posterUrl: data.bannerUrl || "",
      episodeNumber: 1
    }];
  } else if (!data.episodes) {
    data.episodes = [];
  } else {
    // Sort episodes by episodeNumber if defined
    data.episodes.sort((a: any, b: any) => {
      const numA = a.episodeNumber !== undefined && a.episodeNumber !== null ? Number(a.episodeNumber) : 0;
      const numB = b.episodeNumber !== undefined && b.episodeNumber !== null ? Number(b.episodeNumber) : 0;
      return numA - numB;
    });
  }
  
  return data as FirestoreFilm;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function parseDate(val: any): number {
  if (!val) return 0;
  if (typeof val === 'object' && val.seconds) {
    return val.seconds * 1000;
  }
  if (val.toDate && typeof val.toDate === 'function') {
    return val.toDate().getTime();
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function sortFilmsByCreatedAtDesc(films: FirestoreFilm[]): FirestoreFilm[] {
  return films.sort((a, b) => {
    const timeA = parseDate(a.createdAt || a.updatedAt);
    const timeB = parseDate(b.createdAt || b.updatedAt);
    return timeB - timeA;
  });
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function compareFilmTitlesForMenu(a: FirestoreFilm, b: FirestoreFilm): number {
  const titleA = normalizeTitle(a.title);
  const titleB = normalizeTitle(b.title);
  const numA = titleA.match(/^\d+/);
  const numB = titleB.match(/^\d+/);

  if (numA && numB) {
    const intA = parseInt(numA[0], 10);
    const intB = parseInt(numB[0], 10);
    if (intA !== intB) return intA - intB;
    return titleA.localeCompare(titleB, undefined, { sensitivity: 'base', numeric: true });
  }
  if (numA) return -1;
  if (numB) return 1;
  return titleA.localeCompare(titleB, undefined, { sensitivity: 'base', numeric: true });
}

function sortFilmsByMenuTitle(films: FirestoreFilm[]): FirestoreFilm[] {
  return films.sort(compareFilmTitlesForMenu);
}

// ─── FIREBASE LIMIT / PAGINATION QUERIES (LIVE FIRESTORE) ─────────────────────

export async function loadFeaturedFilms(limitCount = 5, _includesDrafts = false): Promise<FirestoreFilm[]> {
  try {
    const q = query(collection(db, "films"));
    const snap = await getDocs(q);
    let list: FirestoreFilm[] = [];
    snap.forEach(docSnap => {
      const data = parseDocDataToFilm(docSnap.id, docSnap.data());
      if ((_includesDrafts || data.status === "published") && (data.type === 'film' || data.type === 'series')) {
        list.push(data);
      }
    });
    list = sortFilmsByCreatedAtDesc(list);
    return list.slice(0, limitCount);
  } catch (err) {
    console.error("Error in loadFeaturedFilms:", err);
    throw err;
  }
}

export async function loadTrendingFilms(limitCount = 10, _includesDrafts = false): Promise<FirestoreFilm[]> {
  try {
    const q = query(collection(db, "films"));
    const snap = await getDocs(q);
    let list: FirestoreFilm[] = [];
    snap.forEach(docSnap => {
      const data = parseDocDataToFilm(docSnap.id, docSnap.data());
      if ((_includesDrafts || data.status === "published") && (data.type === 'film' || data.type === 'series')) {
        list.push(data);
      }
    });
    list = sortFilmsByCreatedAtDesc(list);
    return list.slice(0, limitCount);
  } catch (err) {
    console.error("Error in loadTrendingFilms:", err);
    throw err;
  }
}

export async function loadRecentlyAdded(limitCount = 5, _includesDrafts = false): Promise<FirestoreFilm[]> {
  try {
    const q = query(collection(db, "films"));
    const snap = await getDocs(q);
    let list: FirestoreFilm[] = [];
    snap.forEach(docSnap => {
      const data = parseDocDataToFilm(docSnap.id, docSnap.data());
      if ((_includesDrafts || data.status === "published") && (data.type === 'film' || data.type === 'series')) {
        list.push(data);
      }
    });
    list = sortFilmsByCreatedAtDesc(list);
    return list.slice(0, limitCount);
  } catch (err) {
    console.error("Error in loadRecentlyAdded:", err);
    throw err;
  }
}

export async function fetchFilmsByIds(ids: string[]): Promise<FirestoreFilm[]> {
  try {
    if (!ids || ids.length === 0) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 10) {
      chunks.push(ids.slice(i, i + 10));
    }
    const results: FirestoreFilm[] = [];
    for (const chunk of chunks) {
      const qFilms = query(collection(db, "films"), where("id", "in", chunk));
      const qMatcha = query(collection(db, "matcha"), where("id", "in", chunk));
      
      const [snapFilms, snapMatcha] = await Promise.all([
        getDocs(qFilms),
        getDocs(qMatcha).catch(err => {
          console.warn("Could not query 'matcha' collection in fetchFilmsByIds (probably due to security rules):", err);
          return { forEach: () => {} } as any; // return dummy empty snapshot
        })
      ]);
      
      snapFilms.forEach(docSnap => {
        results.push(parseDocDataToFilm(docSnap.id, docSnap.data()));
      });
      
      if (snapMatcha && typeof snapMatcha.forEach === 'function') {
        snapMatcha.forEach((docSnap: any) => {
          results.push(parseDocDataToFilm(docSnap.id, docSnap.data()));
        });
      }
    }
    return results;
  } catch (err) {
    console.error("Error in fetchFilmsByIds:", err);
    throw err;
  }
}

export interface PaginatedResult {
  films: FirestoreFilm[];
  lastVisible: any;
  totalCount: number;
}

export async function loadFilmsPaginated(
  type: "film" | "series" | "movie_series" | "all" | "mocha" | "matcha" | "indonesia" | "anime",
  limitCount = 12,
  startAfterDoc: any = null,
  _includesDrafts = false,
  matchaSubFilter?: "bl_series" | "bl_movie" | "secret"
): Promise<PaginatedResult> {
  try {
    const collName = type === "matcha" ? "matcha" : "films";
    let snap;
    try {
      snap = await getDocs(query(collection(db, collName)));
    } catch (err: any) {
      if (type === "matcha" && err.code === "permission-denied") {
        console.error("Firestore permissions denied for collection 'matcha':", err);
        throw new Error("FIRESTORE_PERMISSION_DENIED_MATCHA");
      }
      throw err;
    }
    let fullList: FirestoreFilm[] = [];

    snap.forEach(docSnap => {
      const data = parseDocDataToFilm(docSnap.id, docSnap.data());
      if (!_includesDrafts && data.status !== "published") return;
      
      if (type === 'all') {
        if (data.type === 'film' || data.type === 'series') {
          fullList.push(data);
        }
      } else if (type === 'matcha') {
        const currentUser = auth.currentUser;
        const userEmail = currentUser?.email || 'admin';
        const matchaCategory = (data as any).matchaCategory;
        const seriesCategory = (data as any).seriesCategory;
        const isBlSeries = matchaSubFilter === 'bl_series' && (
          matchaCategory === 'bl_series' || (matchaCategory === 'bl' && seriesCategory === 'tv')
        );
        const isBlMovie = matchaSubFilter === 'bl_movie' && (
          matchaCategory === 'bl_movie' || (matchaCategory === 'bl' && seriesCategory === 'movie')
        );
        const isSecret = matchaSubFilter === 'secret' && matchaCategory === 'secret';
        if (data.type === 'matcha' && data.uploadedBy === userEmail && (isBlSeries || isBlMovie || isSecret)) {
          fullList.push(data);
        }
      } else if (type === 'series') {
        if (
          data.type === 'series' &&
          data.seriesCategory === 'tv' &&
          String(data.country || '').toLowerCase() !== 'indonesia'
        ) {
          fullList.push(data);
        }
      } else if (type === 'movie_series') {
        if (
          data.type === 'series' &&
          data.seriesCategory === 'movie' &&
          String(data.country || '').toLowerCase() !== 'indonesia'
        ) {
          fullList.push(data);
        }
      } else if (type === 'film') {
        if (
          data.type === 'film' &&
          String(data.country || '').toLowerCase() !== 'indonesia'
        ) {
          fullList.push(data);
        }
      } else if (type === 'anime') {
        if (data.type === 'series' && data.seriesCategory === 'anime') {
          fullList.push(data);
        }
      } else if (type === 'indonesia') {
        if ((data.type === 'film' || data.type === 'series') && String(data.country || '').toLowerCase() === 'indonesia') {
          fullList.push(data);
        }
      } else if (type === 'mocha') {
        // Mocha filtering is handled elsewhere or currently not supported here.
      }
    });

    if (["film", "series", "movie_series", "indonesia", "anime"].includes(type)) {
      fullList = sortFilmsByMenuTitle(fullList);
    } else {
      fullList = sortFilmsByCreatedAtDesc(fullList);
    }

    let startIndex = 0;
    if (startAfterDoc) {
      startIndex = fullList.findIndex(f => f.id === startAfterDoc.id) + 1;
    }
    
    const paginated = fullList.slice(startIndex, startIndex + limitCount);
    const lastVisible = paginated.length > 0 ? paginated[paginated.length - 1] : null;
    
    return { films: paginated, lastVisible, totalCount: fullList.length };
  } catch (err) {
    console.error("Error in loadFilmsPaginated:", err);
    throw err;
  }
}

export async function searchFilmsFirestore(
  searchQuery: string,
  limitCount = 16,
  _includesDrafts = false,
  activeFilter: "all" | "film" | "series" | "movie_series" | "mocha" | "matcha" | "indonesia" | "anime" = "all"
): Promise<FirestoreFilm[]> {
  try {
    const queryStr = searchQuery.trim().toLowerCase();
    if (!queryStr) return [];
    
    const collName = activeFilter === "matcha" ? "matcha" : "films";
    let snap;
    try {
      snap = await getDocs(query(collection(db, collName)));
    } catch (err: any) {
      if (activeFilter === "matcha" && err.code === "permission-denied") {
        console.error("Firestore permissions denied for collection 'matcha' during search:", err);
        throw new Error("FIRESTORE_PERMISSION_DENIED_MATCHA");
      }
      throw err;
    }
    let results: FirestoreFilm[] = [];
    snap.forEach(docSnap => {
      const data = parseDocDataToFilm(docSnap.id, docSnap.data());
      if (!_includesDrafts && data.status !== "published") return;
      
      const matchesSearch = data.title.toLowerCase().includes(queryStr);
      if (!matchesSearch) return;
      
      if (activeFilter === 'all') {
        if (data.type === 'film' || data.type === 'series') {
          results.push(data);
        }
      } else if (activeFilter === 'matcha') {
        const currentUser = auth.currentUser;
        const userEmail = currentUser?.email || 'admin';
        if (data.type === 'matcha' && data.uploadedBy === userEmail) {
          results.push(data);
        }
      } else if (activeFilter === 'series') {
        if (
          data.type === 'series' &&
          data.seriesCategory === 'tv' &&
          String(data.country || '').toLowerCase() !== 'indonesia'
        ) {
          results.push(data);
        }
      } else if (activeFilter === 'movie_series') {
        if (
          data.type === 'series' &&
          data.seriesCategory === 'movie' &&
          String(data.country || '').toLowerCase() !== 'indonesia'
        ) {
          results.push(data);
        }
      } else if (activeFilter === 'film') {
        if (
          data.type === 'film' &&
          String(data.country || '').toLowerCase() !== 'indonesia'
        ) {
          results.push(data);
        }
      } else if (activeFilter === 'anime') {
        if (data.type === 'series' && data.seriesCategory === 'anime') {
          results.push(data);
        }
      } else if (activeFilter === 'indonesia') {
        if ((data.type === 'film' || data.type === 'series') && String(data.country || '').toLowerCase() === 'indonesia') {
          results.push(data);
        }
      } else if (activeFilter === 'mocha') {
        // Mocha searching is not currently handled here.
      }
    });
    
    if (["film", "series", "movie_series", "indonesia", "anime"].includes(activeFilter)) {
      results = sortFilmsByMenuTitle(results);
    } else {
      results = sortFilmsByCreatedAtDesc(results);
    }
    return results.slice(0, limitCount);
  } catch (err) {
    console.error("Error in searchFilmsFirestore:", err);
    throw err;
  }
}

export async function loadFirestoreLibrary(includesDrafts = false): Promise<FirestoreFilm[]> {
  try {
    const q = query(collection(db, "films"));
    const snap = await getDocs(q);
    let list: FirestoreFilm[] = [];
    snap.forEach(docSnap => {
      const data = parseDocDataToFilm(docSnap.id, docSnap.data());
      if (includesDrafts || data.status === "published") {
        list.push(data);
      }
    });
    list = sortFilmsByCreatedAtDesc(list);
    return list;
  } catch (err) {
    console.error("Error in loadFirestoreLibrary:", err);
    throw err;
  }
}

// ─── HELPERS (GETTERS) ───────────────────────────────────────────────────────

export function getSeasons(film: FirestoreFilm): number[] {
  if (!film.episodes) return [];
  const sns = film.episodes
    .map(e => e.season)
    .filter((s): s is number => s !== null && s !== undefined);
  return Array.from(new Set(sns)).sort((a, b) => a - b);
}

export function getEpisodesBySeason(film: FirestoreFilm, season: number): FirestoreEpisode[] {
  if (!film.episodes) return [];
  return film.episodes.filter(e => e.season === season);
}

export function getFirstPlayableEpisode(film: FirestoreFilm): FirestoreEpisode | null {
  if (!film.episodes || film.episodes.length === 0) return null;
  return film.episodes[0];
}

export function formatFilmType(film: FirestoreFilm): string {
  if (film.type === "film") return "Film";
  if (film.type === "matcha") return "Matcha";
  return film.seriesCategory === "movie" ? "Movie Series" : "TV Series";
}

export async function getUserSettings(email: string) {
  try {
    const docRef = doc(db, "user_settings", email);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (err) {
    console.error("Error fetching user settings:", err);
    return null;
  }
}

export async function saveUserSettings(email: string, settings: { matchaLocked: boolean; matchaPin: string | null }) {
  try {
    const docRef = doc(db, "user_settings", email);
    await setDoc(docRef, settings, { merge: true });
    return true;
  } catch (err) {
    console.error("Error saving user settings:", err);
    throw err;
  }
}

export async function getUserRole(uid: string): Promise<string | null> {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().role || null;
    }
    return null;
  } catch (err) {
    console.error("Error fetching user role:", err);
    return null;
  }
}

export async function deleteFilmFirestore(id: string, type?: string): Promise<void> {
  try {
    if (type === "matcha") {
      await deleteDoc(doc(db, "matcha", id));
    } else if (type === "film" || type === "series") {
      await deleteDoc(doc(db, "films", id));
    } else {
      // Fallback: hapus dari kedua koleksi secara paralel
      await Promise.all([
        deleteDoc(doc(db, "films", id)),
        deleteDoc(doc(db, "matcha", id)).catch(() => {})
      ]);
    }
  } catch (err) {
    console.error("Error in deleteFilmFirestore:", err);
    throw err;
  }
}
