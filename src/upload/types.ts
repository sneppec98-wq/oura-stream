export interface EpisodeItem {
  id?: string;
  title: string;
  releaseYear: number | string;
  videoUrl: string;
  storage: string;
  season: number | null;
  posterFile: File | null;
  posterPreview: string;
  posterUrl: string;
  episodeNumber?: number | null;
}

export interface UploadState {
  type: string;
  seriesCategory: string;
  matchaCategory: string;
  hasSeason: boolean;
  activeSeasonTab: number;
  seasonTabs: number[];
  bannerFile: File | null;
  bannerPrev: string;
  lockedBannerUrl: string;
  episodes: EpisodeItem[];
  r2Files: { objects: any[]; folders: any[] };
  currentPrefix: string;
  activeEpIdx: number | null;
  uploading: boolean;
  episodePage: number;
  episodePageSize: number;
  editingFilmId: string | null;
  editingFilmCreatedAt: string | null;
  editingFilmUploadedBy: string | null;
  currentFolderId: string;
  selectedByseFiles: any[];
  byseFoldersList: any[];
  byseFilesList: any[];
  visibleFiles: any[];
  folderNamesCache: { [id: string]: string };
  uploadStatus: 'draft' | 'published';
}

export type ToastType = "success" | "error" | "info";
export type UploadTab = "info" | "content";
