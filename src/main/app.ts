import "./console";
import { invoke } from "@tauri-apps/api/core";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { setupUploadLogic } from "../upload";
import { setupConsoleLogListeners } from "./console";
import { saveAppState, restoreAppState, appState } from "./state";
import { bindAppEvents, loadR2StorageStats } from "./navigation";
import { initPlayer } from "./player";
import { renderLibrary, refreshLibrary, switchView } from "./library";
import { renderMyListView } from "./mylist";
import { updateAuthUI } from "./auth";
import { syncMatchaSecurityFromFirestore } from "./matcha";
import { getUserRole } from "../firestore";
import type { AppSettings } from "./types";
import { showToast } from "./dialogs";
import { initializeDraftsView } from "./drafts";

window.addEventListener("DOMContentLoaded", async () => {
  const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

  if (isTauri) {
    try {
      const settings = await invoke<AppSettings>("load_settings");
      appState.settings = settings;
      console.log("Settings loaded from Rust backend:", settings);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }

  bindAppEvents();
  initPlayer();
  setupConsoleLogListeners();
  initializeDraftsView();
  restoreAppState();
  if (document.querySelector(".app-view.active")?.id === "view-mylist") {
    await renderMyListView();
  }
  if (document.querySelector(".app-view.active")?.id === "view-settings") {
    loadR2StorageStats();
  }
  updateAuthUI();

  onAuthStateChanged(auth, async (user) => {
    updateAuthUI();
    await syncMatchaSecurityFromFirestore();
    if (user) {
      try {
        appState.currentUserRole = await getUserRole(user.uid);
      } catch (roleErr) {
        console.error("Failed to get user role on auth change:", roleErr);
        appState.currentUserRole = null;
      }
      await refreshLibrary();
    } else {
      appState.currentUserRole = null;
    }
  });

  renderLibrary();
  setupUploadLogic(showToast, () => {
    switchView("view-library", "nav-home");
    saveAppState();
  });
});
