import { auth } from "../firebase";
import { getUserSettings, saveUserSettings } from "../firestore";
import { showToast } from "./dialogs";
import { appState } from "./state";

export async function syncMatchaSecurityFromFirestore() {
  const currentUser = auth.currentUser;
  if (currentUser && currentUser.email) {
    const settingsData = await getUserSettings(currentUser.email);
    if (settingsData) {
      appState.matchaLocked = settingsData.matchaLocked || false;
      appState.matchaPin = settingsData.matchaPin || "";
      localStorage.setItem("oura_matcha_locked", appState.matchaLocked ? "true" : "false");
      if (appState.matchaPin) {
        localStorage.setItem("oura_matcha_pin", appState.matchaPin);
      } else {
        localStorage.removeItem("oura_matcha_pin");
      }
    } else {
      appState.matchaLocked = false;
      appState.matchaPin = "";
      localStorage.setItem("oura_matcha_locked", "false");
      localStorage.removeItem("oura_matcha_pin");
    }
  } else {
    appState.matchaLocked = false;
    appState.matchaPin = "";
    localStorage.setItem("oura_matcha_locked", "false");
    localStorage.removeItem("oura_matcha_pin");
  }
  
  if (typeof (window as any).updateMatchaLockUI === 'function') {
    (window as any).updateMatchaLockUI();
  }
}

export function setupMatchaSecurity() {
  const btnToggleLock = document.getElementById("btn-toggle-matcha-lock") as HTMLButtonElement;
  const lockStatusText = document.getElementById("matcha-lock-status-text");
  
  const pinModal = document.getElementById("matcha-pin-modal")!;
  const pinHiddenInput = document.getElementById("matcha-pin-hidden-input") as HTMLInputElement;
  const pinDots = document.querySelectorAll(".pin-dots-container .pin-dot");
  
  const pinTitle = document.getElementById("pin-modal-title")!;
  const pinDesc = document.getElementById("pin-modal-desc")!;

  if (!pinModal || !pinHiddenInput || !pinTitle || !pinDesc) {
    console.error("[Matcha Security] CRITICAL: PIN modal elements NOT found in DOM!");
    return;
  }
  
  let enteredPin = "";
  let isSettingPin = false; 
  let tempNewPin = ""; 
  let unlockCallback: (() => void) | null = null;
  
  const updateLockUI = () => {
    if (lockStatusText) {
      lockStatusText.textContent = appState.matchaLocked ? "Status: Aktif" : "Status: Tidak Aktif";
    }
    if (btnToggleLock) {
      btnToggleLock.textContent = appState.matchaLocked ? "Matikan Kunci" : "Aktifkan Kunci";
      btnToggleLock.style.background = appState.matchaLocked ? "rgba(239, 68, 68, 0.15)" : "var(--accent-gradient)";
      btnToggleLock.style.color = appState.matchaLocked ? "#FCA5A5" : "#fff";
      btnToggleLock.style.border = appState.matchaLocked ? "1px solid rgba(239, 68, 68, 0.3)" : "none";
    }
  };
  
  (window as any).updateMatchaLockUI = updateLockUI;
  updateLockUI();
  
  const showPinModal = (settingMode: boolean, titleMsg: string, descMsg: string, callback?: () => void) => {
    enteredPin = "";
    isSettingPin = settingMode;
    pinTitle.textContent = titleMsg;
    pinDesc.textContent = descMsg;
    unlockCallback = callback || null;
    
    pinDots.forEach(dot => dot.className = "pin-dot");
    
    pinModal.classList.add("open");
    pinHiddenInput.value = "";
    setTimeout(() => pinHiddenInput.focus(), 100);
  };
  
  const closePinModal = () => {
    pinModal.classList.remove("open");
    enteredPin = "";
    pinHiddenInput.value = "";
  };
  
  const updateDots = () => {
    pinDots.forEach((dot, idx) => {
      if (idx < enteredPin.length) {
        dot.classList.add("filled");
      } else {
        dot.classList.remove("filled");
      }
    });
  };
  
  const handleKeypadPress = (key: string) => {
    if (enteredPin.length < 4) {
      enteredPin += key;
      updateDots();
      
      if (enteredPin.length === 4) {
        setTimeout(processPinEntry, 200);
      }
    }
  };
  
  const processPinEntry = () => {
    if (isSettingPin) {
      if (!tempNewPin) {
        tempNewPin = enteredPin;
        enteredPin = "";
        updateDots();
        pinTitle.textContent = "Konfirmasi PIN Baru";
        pinDesc.textContent = "Masukkan kembali PIN 4 digit Anda untuk konfirmasi.";
        pinHiddenInput.value = "";
        pinHiddenInput.focus();
      } else {
        if (enteredPin === tempNewPin) {
          const currentUser = auth.currentUser;
          if (currentUser && currentUser.email) {
            saveUserSettings(currentUser.email, { matchaLocked: true, matchaPin: enteredPin })
              .then(() => {
                appState.matchaLocked = true;
                appState.matchaPin = enteredPin;
                localStorage.setItem("oura_matcha_locked", "true");
                localStorage.setItem("oura_matcha_pin", enteredPin);
                showToast("PIN Matcha berhasil disetel!", "success");
                closePinModal();
                updateLockUI();
              })
              .catch(err => {
                showToast("Gagal menyimpan PIN ke database: " + err.message, "error");
              });
          } else {
            showToast("Anda harus login untuk menyetel PIN.", "error");
          }
          tempNewPin = "";
        } else {
          shakePinCard();
          showToast("PIN tidak cocok! Silakan ulangi.", "error");
          enteredPin = "";
          tempNewPin = "";
          updateDots();
          pinTitle.textContent = "Setel PIN Baru";
          pinDesc.textContent = "Masukkan PIN 4 digit baru untuk mengunci Matcha.";
          pinHiddenInput.value = "";
          pinHiddenInput.focus();
        }
      }
    } else {
      const currentPin = appState.matchaPin || localStorage.getItem("oura_matcha_pin") || "";
      if (enteredPin === currentPin) {
        closePinModal();
        if (unlockCallback) {
          unlockCallback();
        }
      } else {
        shakePinCard();
        showToast("PIN Salah!", "error");
        enteredPin = "";
        updateDots();
        pinHiddenInput.value = "";
        pinHiddenInput.focus();
      }
    }
  };
  
  const shakePinCard = () => {
    const card = pinModal.querySelector(".pin-card")!;
    card.classList.add("shake");
    pinDots.forEach(dot => dot.classList.add("error"));
    
    setTimeout(() => {
      card.classList.remove("shake");
      pinDots.forEach(dot => dot.classList.remove("error"));
    }, 400);
  };
  
  pinHiddenInput.addEventListener("input", () => {
    const val = pinHiddenInput.value.replace(/[^0-9]/g, "");
    enteredPin = val;
    updateDots();
    if (enteredPin.length === 4) {
      setTimeout(processPinEntry, 200);
    }
  });
  
  pinModal.addEventListener("click", (e) => {
    if (e.target === pinModal || (e.target as HTMLElement).closest(".pin-card")) {
      pinHiddenInput.focus();
    }
  });
  
  pinModal.querySelectorAll(".pin-key-btn[data-key]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const key = (e.target as HTMLElement).getAttribute("data-key")!;
      handleKeypadPress(key);
    });
  });
  
  document.getElementById("btn-pin-cancel")?.addEventListener("click", (e) => {
    e.stopPropagation();
    closePinModal();
    if (!isSettingPin) {
      document.getElementById("nav-home")?.click();
    }
  });
  
  document.getElementById("btn-pin-delete")?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (enteredPin.length > 0) {
      enteredPin = enteredPin.slice(0, -1);
      pinHiddenInput.value = enteredPin;
      updateDots();
    }
  });
  
  btnToggleLock?.addEventListener("click", () => {
    if (appState.matchaLocked) {
      showPinModal(false, "Matikan Kunci Matcha", "Masukkan PIN Anda untuk mematikan penguncian.", () => {
        const currentUser = auth.currentUser;
        if (currentUser && currentUser.email) {
          saveUserSettings(currentUser.email, { matchaLocked: false, matchaPin: null })
            .then(() => {
              appState.matchaLocked = false;
              appState.matchaPin = "";
              localStorage.setItem("oura_matcha_locked", "false");
              localStorage.removeItem("oura_matcha_pin");
              showToast("Kunci Matcha dinonaktifkan.", "success");
              updateLockUI();
            })
            .catch(err => {
              showToast("Gagal mengubah setelan ke database: " + err.message, "error");
            });
        } else {
          showToast("Anda harus login untuk mematikan kunci.", "error");
        }
      });
    } else {
      tempNewPin = "";
      showPinModal(true, "Setel PIN Baru", "Masukkan PIN 4 digit baru untuk mengunci Matcha.");
    }
  });
  
  (window as any).triggerMatchaVerification = (successCallback: () => void) => {
    const isLocked = localStorage.getItem("oura_matcha_locked") === "true";
    if (isLocked) {
      showPinModal(false, "Masukkan PIN Keamanan", "Kategori Matcha dilindungi oleh PIN keamanan.", successCallback);
    } else {
      successCallback();
    }
  };
}
