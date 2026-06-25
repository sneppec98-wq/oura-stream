import { appState } from "../state";
import { renderLibrary } from "../library";

export function renderPaginationControls(_pageItemCount: number, totalCount: number = 0) {
  const container = document.getElementById("pagination-controls");
  if (!container) return;

  const totalPages = Math.max(1, Math.ceil(totalCount / appState.gridItemsPerPage));
  const prevDisabled = appState.gridCurrentPage === 1 ? "disabled" : "";
  const nextDisabled = appState.gridCurrentPage >= totalPages ? "disabled" : "";

  container.innerHTML = `
    <button class="pagination-btn" id="pagination-prev" ${prevDisabled}>Sebelumnya</button>
    <span class="pagination-info">Halaman ${appState.gridCurrentPage} dari ${totalPages}</span>
    <button class="pagination-btn" id="pagination-next" ${nextDisabled}>Berikutnya</button>
  `;

  document.getElementById("pagination-prev")?.addEventListener("click", () => {
    if (appState.gridCurrentPage > 1) {
      appState.gridCurrentPage--;
      appState.gridPageCursors.pop();
      renderLibrary();
    }
  });

  document.getElementById("pagination-next")?.addEventListener("click", () => {
    if (appState.gridCurrentPage < totalPages) {
      if (appState.gridLastVisibleDoc) {
        appState.gridPageCursors.push(appState.gridLastVisibleDoc);
      }
      appState.gridCurrentPage++;
      renderLibrary();
    }
  });
}
