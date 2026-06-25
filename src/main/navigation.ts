import { appState, disableMatchaManageMode, saveAppState } from "./state";
import { deleteFilmFirestore } from "../firestore";
import { switchView, renderLibrary, refreshLibrary } from "./library";
import { setupMatchaSecurity } from "./matcha";
import { showCustomConfirm, showToast } from "./dialogs";
import { handleFirebaseLogin, handleSignOut } from "./auth";
import { refreshDraftsView } from "./drafts";

function loadSettingsToForm() {
  const byseUrlEl = document.getElementById("settings-byse-url") as HTMLInputElement;
  const byseKeyEl = document.getElementById("settings-byse-key") as HTMLInputElement;
  const saveBtn = document.getElementById("btn-save-byse-settings") as HTMLButtonElement;
  
  const savedUrl = localStorage.getItem("oura_byse_api_url") || "https://api.byse.sx/file/list";
  const savedKey = localStorage.getItem("oura_byse_api_key") || "";
  
  if (byseUrlEl) byseUrlEl.value = savedUrl;
  if (byseKeyEl) byseKeyEl.value = savedKey;
  
  if (savedKey && saveBtn && byseUrlEl && byseKeyEl) {
    byseUrlEl.disabled = true;
    byseKeyEl.disabled = true;
    saveBtn.textContent = "Ubah Setelan Byse.sx";
  }
}

export function bindAppEvents() {
  loadSettingsToForm();

  // Use event delegation for submenus to survive DOM updates
  document.body.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const submenuBtn = target.closest(".has-submenu");
    
    if (submenuBtn) {
      e.preventDefault();
      e.stopPropagation();
      const group = submenuBtn.closest(".nav-group");
      
      // Close others
      document.querySelectorAll(".nav-group.expanded").forEach(g => {
        if (g !== group) g.classList.remove("expanded");
      });
      
      if (group) {
        group.classList.toggle("expanded");
        console.log("Toggled submenu group:", group.id);
      }
      return;
    }
    
    // Close submenus when clicking outside
    if (!target.closest(".nav-group")) {
      document.querySelectorAll(".nav-group.expanded").forEach(g => g.classList.remove("expanded"));
    }
  });

  document.getElementById("btn-save-byse-settings")?.addEventListener("click", () => {
    const byseUrlEl = document.getElementById("settings-byse-url") as HTMLInputElement;
    const byseKeyEl = document.getElementById("settings-byse-key") as HTMLInputElement;
    const saveBtn = document.getElementById("btn-save-byse-settings") as HTMLButtonElement;
    
    if (byseUrlEl && byseKeyEl && saveBtn) {
      const isLocked = byseUrlEl.disabled;
      
      if (isLocked) {
        const doUnlock = () => {
          byseUrlEl.disabled = false;
          byseKeyEl.disabled = false;
          byseKeyEl.focus();
          saveBtn.textContent = "Simpan Setelan Byse.sx";
        };

        const pinActive = localStorage.getItem("oura_matcha_locked") === "true";
        if (pinActive && typeof (window as any).triggerMatchaVerification === "function") {
          (window as any).triggerMatchaVerification(doUnlock);
        } else {
          doUnlock();
        }
      } else {
        const urlVal = byseUrlEl.value.trim();
        const keyVal = byseKeyEl.value.trim();
        
        if (!urlVal || !keyVal) {
          showToast("API Base URL dan API Key harus diisi untuk menyimpan.", "error");
          return;
        }

        localStorage.setItem("oura_byse_api_url", urlVal);
        localStorage.setItem("oura_byse_api_key", keyVal);
        
        byseUrlEl.disabled = true;
        byseKeyEl.disabled = true;
        saveBtn.textContent = "Ubah Setelan Byse.sx";
        
        showToast("Setelan Byse.sx berhasil disimpan!", "success");
      }
    }
  });

  document.getElementById("nav-home")?.addEventListener("click", () => {
    appState.activeFilter = "all";
    appState.searchQuery = "";
    const searchInput = document.getElementById("search-input") as HTMLInputElement;
    if (searchInput) searchInput.value = "";
    
    switchView("view-library", "nav-home");
    saveAppState();
    renderLibrary();
  });

  document.getElementById("nav-movies")?.addEventListener("click", () => {
    appState.activeFilter = "film";
    appState.searchQuery = "";
    const searchInput = document.getElementById("search-input") as HTMLInputElement;
    if (searchInput) searchInput.value = "";
    
    switchView("view-library", "nav-movies");
    saveAppState();
    renderLibrary();
  });

  document.getElementById("nav-movie-series")?.addEventListener("click", () => {
    appState.activeFilter = "movie_series";
    appState.searchQuery = "";
    const searchInput = document.getElementById("search-input") as HTMLInputElement;
    if (searchInput) searchInput.value = "";
    
    switchView("view-library", "nav-movie-series");
    saveAppState();
    renderLibrary();
  });

  document.getElementById("nav-series")?.addEventListener("click", () => {
    appState.activeFilter = "series";
    appState.searchQuery = "";
    const searchInput = document.getElementById("search-input") as HTMLInputElement;
    if (searchInput) searchInput.value = "";
    
    switchView("view-library", "nav-series");
    saveAppState();
    renderLibrary();
  });

  document.getElementById("nav-indonesia")?.addEventListener("click", () => {
    appState.activeFilter = "indonesia";
    appState.searchQuery = "";
    const searchInput = document.getElementById("search-input") as HTMLInputElement;
    if (searchInput) searchInput.value = "";

    switchView("view-library", "nav-indonesia");
    saveAppState();
    renderLibrary();
  });

  document.getElementById("nav-anime")?.addEventListener("click", () => {
    appState.activeFilter = "anime";
    appState.searchQuery = "";
    const searchInput = document.getElementById("search-input") as HTMLInputElement;
    if (searchInput) searchInput.value = "";

    switchView("view-library", "nav-anime");
    saveAppState();
    renderLibrary();
  });

  document.getElementById("nav-matcha")?.addEventListener("click", () => {
    const navigateToMatcha = () => {
      disableMatchaManageMode();
      appState.activeFilter = "matcha";
      appState.searchQuery = "";
      const searchInput = document.getElementById("search-input") as HTMLInputElement;
      if (searchInput) searchInput.value = "";
      
      switchView("view-library", "nav-matcha");
      saveAppState();
      renderLibrary();
    };

    const isLocked = localStorage.getItem("oura_matcha_locked") === "true";
    if (isLocked) {
      (window as any).triggerMatchaVerification(navigateToMatcha);
    } else {
      navigateToMatcha();
    }
  });

  document.getElementById("btn-upload-matcha")?.addEventListener("click", () => {
    const btnTypeFilm = document.querySelector("#up-type-group [data-type='film']") as HTMLElement;
    const btnTypeSeries = document.querySelector("#up-type-group [data-type='series']") as HTMLElement;
    const btnTypeMatcha = document.getElementById("btn-type-matcha") as HTMLElement;
    
    if (btnTypeFilm) btnTypeFilm.style.display = "none";
    if (btnTypeSeries) btnTypeSeries.style.display = "none";
    if (btnTypeMatcha) {
      btnTypeMatcha.style.display = "inline-block";
      btnTypeMatcha.click();
    }

    switchView("view-upload", "nav-downloads");
    saveAppState();
  });

  document.getElementById("nav-drafts")?.addEventListener("click", () => {
    switchView("view-drafts", "nav-drafts");
    saveAppState();
    refreshDraftsView();
  });

  document.getElementById("nav-downloads")?.addEventListener("click", () => {
    if (typeof (window as any).resetUploadForm === "function") {
      (window as any).resetUploadForm();
    }
    const btnTypeFilm = document.querySelector("#up-type-group [data-type='film']") as HTMLElement;
    const btnTypeSeries = document.querySelector("#up-type-group [data-type='series']") as HTMLElement;
    const btnTypeMatcha = document.getElementById("btn-type-matcha") as HTMLElement;
    
    if (btnTypeFilm) btnTypeFilm.style.display = "inline-block";
    if (btnTypeSeries) btnTypeSeries.style.display = "inline-block";
    if (btnTypeMatcha) btnTypeMatcha.style.display = "none";
    
    if (btnTypeFilm) btnTypeFilm.click();

    switchView("view-upload", "nav-downloads");
    saveAppState();
  });

  document.getElementById("nav-settings")?.addEventListener("click", () => {
    switchView("view-settings", "nav-settings");
    saveAppState();
    loadR2StorageStats();
  });

  document.getElementById("btn-refresh-r2-storage")?.addEventListener("click", () => {
    loadR2StorageStats();
  });


  document.getElementById("btn-toggle-sidebar-collapse")?.addEventListener("click", () => {
    const appBody = document.querySelector(".app-body");
    const sidebar = document.querySelector(".sidebar");
    const btn = document.getElementById("btn-toggle-sidebar-collapse");
    if (!appBody || !sidebar || !btn) return;

    appState.isSidebarCollapsed = !appState.isSidebarCollapsed;
    appBody.classList.toggle("sidebar-collapsed", appState.isSidebarCollapsed);
    sidebar.classList.toggle("collapsed", appState.isSidebarCollapsed);
    btn.title = appState.isSidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar";
    const icon = btn.querySelector("svg");
    if (icon) {
      icon.style.transform = appState.isSidebarCollapsed ? "rotate(0deg)" : "rotate(180deg)";
    }
  });

  document.getElementById("user-profile-menu")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById("profile-dropdown-menu");
    if (dropdown) {
      const isHidden = dropdown.style.display === "none";
      dropdown.style.display = isHidden ? "flex" : "none";
    }
  });

  document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("profile-dropdown-menu");
    if (dropdown && dropdown.style.display === "flex") {
      const target = e.target as HTMLElement;
      if (!target.closest(".profile-menu-container")) {
        dropdown.style.display = "none";
      }
    }
  });

  document.getElementById("btn-logout-action")?.addEventListener("click", async () => {
    const confirm = await showCustomConfirm("Konfirmasi Keluar", "Apakah Anda yakin ingin keluar dari akun Anda?");
    if (confirm) {
      await handleSignOut();
    }
  });

  document.getElementById("btn-notifications")?.addEventListener("click", () => {
    showToast("Tidak ada notifikasi baru.", "info");
  });

  document.getElementById("btn-refresh-library")?.addEventListener("click", () => refreshLibrary());
  document.getElementById("btn-empty-refresh")?.addEventListener("click", () => refreshLibrary());

  document.getElementById("btn-close-detail")?.addEventListener("click", () => {
    document.getElementById("detail-modal")?.classList.remove("open");
  });
  document.getElementById("detail-modal")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) document.getElementById("detail-modal")?.classList.remove("open");
  });

  document.getElementById("firebase-login-form")?.addEventListener("submit", handleFirebaseLogin);

  document.querySelector(".forgot-pw-link")?.addEventListener("click", async (e) => {
    e.preventDefault();
    showToast("Fitur ini belum tersedia.", "info");
  });

  const toggleLoginBtn = document.getElementById("btn-toggle-login-pane");
  const authFormSide = document.querySelector(".auth-form-side") as HTMLElement;
  if (toggleLoginBtn && authFormSide) {
    toggleLoginBtn.addEventListener("click", () => {
      const isHidden = authFormSide.classList.toggle("login-hidden");
      const toggleText = toggleLoginBtn.querySelector(".toggle-text") as HTMLElement;
      if (toggleText) {
        toggleText.textContent = isHidden ? "Login" : "Hide";
      }
    });
  }

  const togglePwBtn = document.getElementById("btn-toggle-pw");
  if (togglePwBtn) {
    togglePwBtn.addEventListener("click", () => {
      const pwInput = document.getElementById("fb-password") as HTMLInputElement;
      if (pwInput) {
        const isPassword = pwInput.type === "password";
        pwInput.type = isPassword ? "text" : "password";
        const eyeIcon = togglePwBtn.querySelector(".eye-icon");
        if (eyeIcon) {
          if (isPassword) {
            eyeIcon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
          } else {
            eyeIcon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />`;
          }
        }
      }
    });
  }

  document.querySelectorAll<HTMLButtonElement>("#matcha-tabs .filter-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      disableMatchaManageMode();
      document.querySelectorAll("#matcha-tabs .filter-tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      appState.matchaSubFilter = (btn.getAttribute("data-matcha") ?? "bl_series") as "bl_series" | "bl_movie" | "secret";
      appState.gridCurrentPage = 1;
      appState.gridLastVisibleDoc = null;
      appState.gridPageCursors = [];
      saveAppState();
      renderLibrary();
    });
  });

  document.getElementById("search-input")?.addEventListener("input", (e) => {
    disableMatchaManageMode();
    appState.searchQuery = (e.target as HTMLInputElement).value;
    clearTimeout(appState.searchDebounceTimeout);
    appState.searchDebounceTimeout = setTimeout(() => {
      appState.gridCurrentPage = 1;
      appState.gridLastVisibleDoc = null;
      appState.gridPageCursors = [];
      renderLibrary();
    }, 500);
  });

  setupMatchaSecurity();

  document.getElementById("btn-matcha-manage-toggle")?.addEventListener("click", () => {
    const grid = document.getElementById("media-grid");
    const controls = document.getElementById("matcha-bulk-controls");
    const btnToggle = document.getElementById("btn-matcha-manage-toggle");
    
    if (grid && controls && btnToggle) {
      const isManage = grid.classList.toggle("manage-mode");
      controls.style.display = isManage ? "flex" : "none";
      btnToggle.textContent = isManage ? "Batal" : "✏️ Kelola";
      btnToggle.classList.toggle("active", isManage);
      
      if (!isManage) {
        appState.selectedMatchaIds = [];
        document.querySelectorAll<HTMLInputElement>(".matcha-card-checkbox").forEach(chk => {
          chk.checked = false;
        });
        const btnDeleteSelected = document.getElementById("btn-matcha-delete-selected") as HTMLButtonElement | null;
        if (btnDeleteSelected) btnDeleteSelected.style.display = "none";
        const btnSelectAll = document.getElementById("btn-matcha-select-all");
        if (btnSelectAll) btnSelectAll.textContent = "Pilih Semua";
      }
    }
  });

  document.getElementById("btn-matcha-select-all")?.addEventListener("click", () => {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(".matcha-card-checkbox");
    const allChecked = Array.from(checkboxes).every(chk => chk.checked);
    
    checkboxes.forEach(chk => {
      chk.checked = !allChecked;
      const id = chk.getAttribute("data-id")!;
      if (!allChecked) {
        if (!appState.selectedMatchaIds.includes(id)) {
          appState.selectedMatchaIds.push(id);
        }
      } else {
        appState.selectedMatchaIds = appState.selectedMatchaIds.filter(x => x !== id);
      }
    });
    
    const btnSelectAll = document.getElementById("btn-matcha-select-all");
    if (btnSelectAll) {
      btnSelectAll.textContent = allChecked ? "Pilih Semua" : "Batal Semua";
    }
    
    const btnDeleteSelected = document.getElementById("btn-matcha-delete-selected") as HTMLButtonElement | null;
    if (btnDeleteSelected) {
      btnDeleteSelected.textContent = `Hapus Terpilih (${appState.selectedMatchaIds.length})`;
      btnDeleteSelected.style.display = appState.selectedMatchaIds.length > 0 ? "block" : "none";
    }
  });

  document.getElementById("btn-matcha-delete-selected")?.addEventListener("click", async () => {
    const count = appState.selectedMatchaIds.length;
    if (count === 0) return;
    
    const confirmDelete = await showCustomConfirm("Konfirmasi Hapus Massal", `Apakah Anda yakin ingin menghapus ${count} item Matcha terpilih?`);
    if (!confirmDelete) return;
    
    setLoadingPlaceholder(true, `Menghapus ${count} Matcha...`);
    try {
      const promises = appState.selectedMatchaIds.map(id => deleteFilmFirestore(id, "matcha"));
      await Promise.all(promises);
      showToast(`${count} Matcha berhasil dihapus!`, "success");
      appState.selectedMatchaIds = [];
      disableMatchaManageMode();
      await refreshLibrary();
    } catch (err: any) {
      showToast(`Gagal menghapus beberapa item: ${err.message}`, "error");
    } finally {
      setLoadingPlaceholder(false);
    }
  });
}

function setLoadingPlaceholder(loading: boolean, message = "Memuat...") {
  const loadingEl = document.getElementById("library-loading");
  if (!loadingEl) return;
  loadingEl.style.display = loading ? "flex" : "none";
  loadingEl.querySelector<HTMLSpanElement>(".loading-text")!.textContent = message;
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export async function loadR2StorageStats() {
  const loadingEl = document.getElementById("r2-storage-loading");
  const errorEl = document.getElementById("r2-storage-error");
  const listEl = document.getElementById("r2-storage-list");
  const totalEl = document.getElementById("r2-storage-total");

  if (!loadingEl || !errorEl || !listEl || !totalEl) return;

  loadingEl.style.display = "flex";
  errorEl.style.display = "none";
  listEl.innerHTML = "";
  totalEl.textContent = "0 B";

  const workerUrl = (import.meta as any).env?.VITE_R2_WORKER_URL || "";
  const authSecret = (import.meta as any).env?.VITE_R2_AUTH_SECRET || "";

  if (!workerUrl || !authSecret) {
    loadingEl.style.display = "none";
    errorEl.style.display = "block";
    errorEl.textContent = "Konfigurasi R2 Worker atau Auth Secret tidak ditemukan di file .env.";
    return;
  }

  try {
    const resp = await fetch(`${workerUrl}/r2-storage-stats`, {
      headers: {
        "X-Auth-Token": authSecret,
      },
    });

    if (!resp.ok) {
      let errText = await resp.text();
      try {
        const parsed = JSON.parse(errText);
        if (parsed && parsed.error) {
          errText = parsed.error;
        }
      } catch (e) {}
      throw new Error(errText || `Server returned ${resp.status}`);
    }

    const data = await resp.json();
    if (!data || !Array.isArray(data.buckets)) {
      throw new Error("Format respon tidak valid.");
    }

    loadingEl.style.display = "none";
    let totalSizeBytes = 0;

    data.buckets.forEach((bucketStat: { bucket: string; objects: number; sizeBytes: number; error?: string }) => {
      totalSizeBytes += bucketStat.sizeBytes;

      const itemDiv = document.createElement("div");
      itemDiv.style.display = "flex";
      itemDiv.style.justifyContent = "space-between";
      itemDiv.style.alignItems = "center";
      itemDiv.style.padding = "10px 14px";
      itemDiv.style.background = "rgba(255,255,255,0.02)";
      itemDiv.style.border = "1px solid rgba(255,255,255,0.06)";
      itemDiv.style.borderRadius = "8px";

      const leftSpan = document.createElement("span");
      leftSpan.style.fontSize = "13px";
      leftSpan.style.fontWeight = "600";
      leftSpan.style.color = "#fff";
      leftSpan.textContent = bucketStat.bucket;

      const rightDiv = document.createElement("div");
      rightDiv.style.display = "flex";
      rightDiv.style.flexDirection = "column";
      rightDiv.style.alignItems = "flex-end";
      rightDiv.style.gap = "2px";

      const sizeSpan = document.createElement("span");
      sizeSpan.style.fontSize = "13px";
      sizeSpan.style.fontWeight = "700";
      sizeSpan.style.color = "#F6821F";
      
      if (bucketStat.error) {
        sizeSpan.textContent = "Error";
        sizeSpan.style.color = "#ff4757";
        sizeSpan.title = bucketStat.error;
      } else {
        sizeSpan.textContent = formatBytes(bucketStat.sizeBytes);
      }

      const countSpan = document.createElement("span");
      countSpan.style.fontSize = "10px";
      countSpan.style.color = "var(--text-secondary)";
      countSpan.textContent = bucketStat.error ? "Akses ditolak" : `${bucketStat.objects} objek`;

      rightDiv.appendChild(sizeSpan);
      rightDiv.appendChild(countSpan);
      itemDiv.appendChild(leftSpan);
      itemDiv.appendChild(rightDiv);
      listEl.appendChild(itemDiv);
    });

    totalEl.textContent = formatBytes(totalSizeBytes);

  } catch (err: any) {
    loadingEl.style.display = "none";
    errorEl.style.display = "block";
    errorEl.textContent = `Gagal memuat: ${err.message}`;
  }
}


