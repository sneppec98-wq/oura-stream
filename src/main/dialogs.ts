export function showToast(message: string, type: "success" | "error" | "info" = "info") {
  let container = document.querySelector<HTMLDivElement>(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let icon = "";
  if (type === "success") {
    icon = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" /></svg>`;
  } else if (type === "error") {
    icon = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>`;
  } else {
    icon = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>`;
  }
  
  toast.innerHTML = `
    ${icon}
    <span class="toast-message">${message}</span>
    <div class="toast-progress"></div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

export function showCustomAlert(title: string, message: string) {
  const overlay = document.createElement("div");
  overlay.className = "custom-dialog-overlay";
  overlay.innerHTML = `
    <div class="custom-dialog-card glass">
      <div class="custom-dialog-header">
        <h3>${title}</h3>
      </div>
      <div class="custom-dialog-body">
        <p>${message.replace(/\n/g, '<br>')}</p>
      </div>
      <div class="custom-dialog-footer">
        <button class="btn btn-primary" id="btn-dialog-ok" style="padding: 8px 20px; border-radius: var(--radius-sm); border: none; background: var(--accent-gradient); color: #fff; cursor: pointer; font-size: 13.5px; font-weight: 600;">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  overlay.querySelector("#btn-dialog-ok")?.addEventListener("click", () => {
    overlay.classList.add("fade-out");
    setTimeout(() => overlay.remove(), 250);
  });
}

export function showCustomConfirm(title: string, message: string, callback?: (confirmed: boolean) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "custom-dialog-overlay";
    
    const isWarning = title.toLowerCase().includes("hapus") || title.toLowerCase().includes("delete") || title.toLowerCase().includes("keluar");
    const borderStyle = isWarning ? "1px solid rgba(239, 68, 68, 0.25)" : "1px solid rgba(255, 255, 255, 0.08)";
    const shadowStyle = isWarning ? "0 16px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(239, 68, 68, 0.05)" : "0 16px 40px rgba(0, 0, 0, 0.8)";
    const icon = isWarning ? "⚠️" : "❓";
    const confirmBtnStyle = isWarning 
      ? "background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #FCA5A5;" 
      : "background: var(--accent-gradient); border: none; color: #fff;";
    const confirmBtnText = isWarning ? "Hapus" : "Ya";

    overlay.innerHTML = `
      <div class="custom-dialog-card glass" style="border: ${borderStyle}; box-shadow: ${shadowStyle}; max-width: 400px;">
        <div class="custom-dialog-header" style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 24px;">${icon}</span>
          <h3 style="margin: 0; font-family: var(--font-main); font-size: 18px; font-weight: 700; color: #fff;">${title}</h3>
        </div>
        <div class="custom-dialog-body">
          <p style="margin: 0; font-family: var(--font-main); font-size: 13.5px; color: var(--text-secondary); line-height: 1.5; font-weight: 500;">${message.replace(/\n/g, '<br>')}</p>
        </div>
        <div class="custom-dialog-footer">
          <button class="btn btn-ghost" id="btn-dialog-cancel" style="padding: 8px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-medium); background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 13.5px; font-weight: 500;">Batal</button>
          <button class="btn btn-primary" id="btn-dialog-confirm" style="padding: 8px 20px; border-radius: var(--radius-sm); ${confirmBtnStyle} cursor: pointer; font-size: 13.5px; font-weight: 600;">${confirmBtnText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const handleResult = (confirmed: boolean) => {
      overlay.classList.add("fade-out");
      setTimeout(() => {
        overlay.remove();
        if (callback) callback(confirmed);
        resolve(confirmed);
      }, 250);
    };

    overlay.querySelector("#btn-dialog-cancel")?.addEventListener("click", () => {
      handleResult(false);
    });

    overlay.querySelector("#btn-dialog-confirm")?.addEventListener("click", () => {
      handleResult(true);
    });
    
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        handleResult(false);
      }
    });
  });
}
