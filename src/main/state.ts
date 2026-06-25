import type { AppSettings } from "./types";
import type { FirestoreFilm, FirestoreEpisode } from "../firestore";
import { auth } from "../firebase";

const ADMIN_EMAILS = ['irulaselole0@gmail.com', 'kimm.stream@gmail.com', 'kim@oura.app', 'admin@gmail.com'];

export const appState = {
  settings: {
    r2: { account_id: "", access_key_id: "", secret_access_key: "", bucket_name: "" },
    gdrive: { client_id: "", client_secret: "", refresh_token: "" },
  } as AppSettings,
  activeFilter: "all" as "all" | "film" | "series" | "movie_series" | "mocha" | "matcha" | "indonesia" | "anime",
  matchaSubFilter: "bl_series" as "bl_series" | "bl_movie" | "secret",
  isSidebarCollapsed: false,
  searchQuery: "",
  activeDetailSeason: 1,
  currentPlayingEp: null as FirestoreEpisode | null,
  currentPlayingFilm: null as FirestoreFilm | null,
  gridCurrentPage: 1,
  gridItemsPerPage: 16,
  gridLastVisibleDoc: null as any,
  gridPageCursors: [] as any[],
  searchDebounceTimeout: null as any,
  isPlayerSidebarCollapsed: false,
  selectedMatchaIds: [] as string[],
  currentLibraryItems: [] as FirestoreFilm[],
  homeCache: null as {
    featured: FirestoreFilm[];
    trending: FirestoreFilm[];
    picks: FirestoreFilm[];
    added: FirestoreFilm[];
    continue: FirestoreFilm[];
  } | null,
  currentUserRole: null as string | null,
  matchaLocked: false,
  matchaPin: "",
};

export function isSuperAdmin(): boolean {
  if (!auth.currentUser) return false;
  if (appState.currentUserRole === "admin") return true;
  return ADMIN_EMAILS.includes(auth.currentUser.email || "");
}

export function disableMatchaManageMode() {
  const grid = document.getElementById("media-grid");
  if (grid && grid.classList.contains("manage-mode")) {
    const btnManageToggle = document.getElementById("btn-matcha-manage-toggle") as HTMLButtonElement | null;
    if (btnManageToggle) {
      btnManageToggle.click();
      return;
    }
  }
  
  if (grid) grid.classList.remove("manage-mode");
  
  const controls = document.getElementById("matcha-bulk-controls");
  if (controls) controls.style.display = "none";
  
  const btnManageToggle = document.getElementById("btn-matcha-manage-toggle") as HTMLButtonElement | null;
  if (btnManageToggle) {
    btnManageToggle.textContent = "✏️ Kelola";
    btnManageToggle.classList.remove("active");
  }
  
  appState.selectedMatchaIds = [];

  const btnDeleteSelected = document.getElementById("btn-matcha-delete-selected") as HTMLButtonElement | null;
  if (btnDeleteSelected) {
    btnDeleteSelected.textContent = "Hapus Terpilih (0)";
    btnDeleteSelected.style.display = "none";
  }
  
  const btnSelectAll = document.getElementById("btn-matcha-select-all");
  if (btnSelectAll) {
    btnSelectAll.textContent = "Pilih Semua";
  }
}

export function saveAppState() {
  try {
    localStorage.setItem("oura_active_filter", appState.activeFilter);
    const activeNavBtn = document.querySelector(".nav-item.active");
    if (activeNavBtn) {
      localStorage.setItem("oura_active_nav_btn", activeNavBtn.id);
    }
    const activeView = document.querySelector(".app-view.active");
    if (activeView) {
      localStorage.setItem("oura_active_view", activeView.id);
    }
  } catch (err) {
    console.error("Failed to save app state:", err);
  }
}

export function restoreAppState() {
  try {
    let savedFilter = localStorage.getItem("oura_active_filter");
    let savedNavBtn = localStorage.getItem("oura_active_nav_btn");
    let savedView = localStorage.getItem("oura_active_view");

    const isMatchaLocked = localStorage.getItem("oura_matcha_locked") === "true";
    if (isMatchaLocked && (savedFilter === "matcha" || savedNavBtn === "nav-matcha")) {
      savedFilter = "all";
      savedNavBtn = "nav-home";
      savedView = "view-library";
      localStorage.setItem("oura_active_filter", "all");
      localStorage.setItem("oura_active_nav_btn", "nav-home");
      localStorage.setItem("oura_active_view", "view-library");
    }

    if (savedFilter === "mocha") {
      savedFilter = "all";
      savedNavBtn = "nav-home";
      savedView = "view-library";
      localStorage.setItem("oura_active_filter", "all");
      localStorage.setItem("oura_active_nav_btn", "nav-home");
      localStorage.setItem("oura_active_view", "view-library");
    }

    if (savedFilter) {
      appState.activeFilter = savedFilter as typeof appState.activeFilter;
    }
    if (savedView) {
      document.querySelectorAll(".app-view").forEach((v) => v.classList.remove("active"));
      switch (savedView as string) {
        case "view-library":
        case "view-settings":
        case "view-upload":
        case "view-mylist":
          document.getElementById(savedView)?.classList.add("active");
          break;
      }
    }

    if (savedNavBtn) {
      document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
      document.getElementById(savedNavBtn)?.classList.add("active");
    }
  } catch (err) {
    console.error("Failed to restore app state:", err);
  }
}
