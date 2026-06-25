import type { LogEntry } from "./types";

const maxLogEntries = 1000;
const appLogs: LogEntry[] = [];
let consoleFilter: 'all' | 'log' | 'info' | 'warn' | 'error' = 'all';
let consoleSearchQuery = '';

// Store original console methods
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
const originalInfo = console.info;
const originalDebug = console.debug;

function addLog(type: LogEntry['type'], ...args: any[]) {
  const message = args.map(arg => {
    if (arg instanceof Error) {
      return `${arg.message}\n${arg.stack || ''}`;
    }
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');

  const entry: LogEntry = {
    timestamp: new Date().toLocaleTimeString(),
    type,
    message
  };
  
  appLogs.push(entry);

  if (appLogs.length > maxLogEntries) {
    appLogs.shift();
  }

  // Render immediately if UI is initialized and open
  const consoleModal = document.getElementById("console-log-modal");
  if (consoleModal && consoleModal.style.display === "flex") {
    appendLogToUI(entry);
    updateLogCount();
  }
}

// Wrap native console methods
console.log = (...args: any[]) => { originalLog(...args); addLog('log', ...args); };
console.warn = (...args: any[]) => { originalWarn(...args); addLog('warn', ...args); };
console.error = (...args: any[]) => { originalError(...args); addLog('error', ...args); };
console.info = (...args: any[]) => { originalInfo(...args); addLog('info', ...args); };
console.debug = (...args: any[]) => { originalDebug(...args); addLog('debug', ...args); };

// Capture unhandled window & promise errors
window.addEventListener('error', (e) => {
  addLog('error', `[Unhandled Error] ${e.message} at ${e.filename}:${e.lineno}:${e.colno}`);
});

window.addEventListener('unhandledrejection', (e) => {
  addLog('error', `[Unhandled Promise Rejection] Reason: ${e.reason}`);
});

function appendLogToUI(entry: LogEntry) {
  const container = document.getElementById("console-log-body");
  if (!container) return;

  if (consoleFilter !== 'all' && entry.type !== consoleFilter) return;
  if (consoleSearchQuery && !entry.message.toLowerCase().includes(consoleSearchQuery.toLowerCase())) return;

  const div = document.createElement("div");
  div.className = `log-line ${entry.type}`;
  
  const timeSpan = document.createElement("span");
  timeSpan.className = "log-time";
  timeSpan.textContent = entry.timestamp;

  const badgeSpan = document.createElement("span");
  badgeSpan.className = "log-badge";
  badgeSpan.textContent = entry.type;

  const msgSpan = document.createElement("span");
  msgSpan.className = "log-message";
  msgSpan.textContent = entry.message;

  div.appendChild(timeSpan);
  div.appendChild(badgeSpan);
  div.appendChild(msgSpan);
  container.appendChild(div);
  
  container.scrollTop = container.scrollHeight;
}

function renderAllLogs() {
  const container = document.getElementById("console-log-body");
  if (!container) return;
  
  container.innerHTML = "";
  appLogs.forEach(entry => appendLogToUI(entry));
  updateLogCount();
}

function updateLogCount() {
  const countEl = document.getElementById("console-log-count");
  if (!countEl) return;

  const filtered = appLogs.filter(entry => {
    if (consoleFilter !== 'all' && entry.type !== consoleFilter) return false;
    if (consoleSearchQuery && !entry.message.toLowerCase().includes(consoleSearchQuery.toLowerCase())) return false;
    return true;
  });

  countEl.textContent = `Tertampil: ${filtered.length} / Total: ${appLogs.length} log`;
}

function copyLogsToClipboard() {
  const text = appLogs.map(entry => `[${entry.timestamp}] [${entry.type.toUpperCase()}] ${entry.message}`).join("\n");
  navigator.clipboard.writeText(text)
    .then(() => {
      const copyBtn = document.getElementById("btn-console-copy") as HTMLButtonElement;
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "✓ Tersalin!";
        setTimeout(() => copyBtn.textContent = originalText, 1500);
      }
    })
    .catch(err => {
      originalError("Gagal menyalin log:", err);
    });
}

export function setupConsoleLogListeners() {
  const modal = document.getElementById("console-log-modal");
  const btnOpen = document.getElementById("btn-open-console-log");
  const btnClose = document.getElementById("btn-close-console");
  const btnClear = document.getElementById("btn-console-clear");
  const btnCopy = document.getElementById("btn-console-copy");
  const searchInput = document.getElementById("console-search") as HTMLInputElement;
  const filterGroup = document.getElementById("console-filter-group");

  const openConsole = () => {
    if (modal) {
      modal.style.display = "flex";
      renderAllLogs();
      setTimeout(() => {
        const container = document.getElementById("console-log-body");
        if (container) container.scrollTop = container.scrollHeight;
      }, 100);
    }
  };

  const closeConsole = () => {
    if (modal) {
      modal.style.display = "none";
    }
  };

  btnOpen?.addEventListener("click", openConsole);
  btnClose?.addEventListener("click", closeConsole);

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeConsole();
    }
  });

  btnClear?.addEventListener("click", () => {
    appLogs.length = 0;
    renderAllLogs();
  });

  btnCopy?.addEventListener("click", copyLogsToClipboard);

  searchInput?.addEventListener("input", (e) => {
    consoleSearchQuery = (e.target as HTMLInputElement).value;
    renderAllLogs();
  });

  filterGroup?.querySelectorAll(".filter-tab").forEach(btn => {
    btn.addEventListener("click", (e) => {
      filterGroup.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
      const target = e.target as HTMLButtonElement;
      target.classList.add("active");
      consoleFilter = (target.getAttribute("data-filter") || "all") as any;
      renderAllLogs();
    });
  });

  // Global keyboard shortcuts (Ctrl + F12 or Ctrl + Shift + L)
  window.addEventListener("keydown", (e) => {
    const isCtrlF12 = e.ctrlKey && e.key === "F12";
    const isCtrlShiftL = e.ctrlKey && e.shiftKey && (e.key === "L" || e.key === "l");

    if (isCtrlF12 || isCtrlShiftL) {
      e.preventDefault();
      if (modal && modal.style.display === "flex") {
        closeConsole();
      } else {
        openConsole();
      }
    }
  });
}
