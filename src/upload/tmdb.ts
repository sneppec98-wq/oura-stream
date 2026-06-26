export interface TMDBResult {
  id: number;
  title: string;
  original_title?: string;
  name?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  origin_country?: string[];
  media_type?: string;
}

export interface TMDBResponse {
  page: number;
  results: TMDBResult[];
  total_pages: number;
  total_results: number;
}

const TMDB_API_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const IMAGE_ORIGINAL_URL = "https://image.tmdb.org/t/p/original";

export function getTMDBApiKey(): string {
  // Try to get from vite env
  const key = (import.meta as any).env?.VITE_TMDB_API_KEY;
  return key || "";
}

export function getPosterUrl(path: string | null, size: 'w500' | 'original' = 'w500'): string {
  if (!path) return "";
  return size === 'w500' ? `${IMAGE_BASE_URL}${path}` : `${IMAGE_ORIGINAL_URL}${path}`;
}

export async function searchTMDB(query: string, type: 'movie' | 'tv' | 'multi' = 'multi'): Promise<TMDBResult[]> {
  const apiKey = getTMDBApiKey();
  if (!apiKey) {
    throw new Error("TMDB API Key tidak ditemukan. Pastikan sudah mengisi VITE_TMDB_API_KEY di .env");
  }

  if (!query.trim()) return [];

  // Kita gunakan bahasa Indonesia, dengan fallback ke bahasa Inggris
  const url = `${TMDB_API_URL}/search/${type}?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=id-ID&page=1&include_adult=false`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Gagal menghubungi TMDB API: ${res.status} ${res.statusText}`);
    }
    const data: TMDBResponse = await res.json();
    return data.results || [];
  } catch (err) {
    console.error("TMDB Search Error:", err);
    throw err;
  }
}
