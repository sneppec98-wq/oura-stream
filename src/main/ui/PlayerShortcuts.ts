export function bindPlayerShortcuts(
  videoEl: HTMLVideoElement,
  closePlayer: () => void,
  togglePlay: () => void
) {
  document.addEventListener("keydown", (e) => {
    const playerOpen = document.getElementById("player-modal")?.style.display !== "none";
    if (e.key === "Escape" && playerOpen) { closePlayer(); return; }
    if (e.key === " " && playerOpen) { e.preventDefault(); togglePlay(); return; }
    if (playerOpen && document.getElementById("native-video")?.style.display !== "none") {
      if (e.key === "ArrowLeft") videoEl.currentTime -= 5;
      if (e.key === "ArrowRight") videoEl.currentTime += 5;
    }
  });
}
