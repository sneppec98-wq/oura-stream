import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { showCustomConfirm, showToast } from './dialogs';

export async function checkForUpdates(manualCheck = false) {
  try {
    const update = await check();
    if (update) {
      console.log(`found update ${update.version} from ${update.date} with notes ${update.body}`);
      
      const shouldUpdate = await new Promise<boolean>((resolve) => {
        showCustomConfirm(
          "Update Tersedia! 🎉", 
          `Versi baru ${update.version} sudah tersedia.\nCatatan: ${update.body || "Peningkatan fitur dan perbaikan bug."}\n\nApakah Anda ingin mengunduh dan memperbarui sekarang?`, 
          () => resolve(true), 
          () => resolve(false)
        );
      });

      if (shouldUpdate) {
        showToast("Sedang mengunduh update... Mohon tunggu.", "info");
        
        let downloaded = 0;
        let contentLength = 0;
        
        await update.downloadAndInstall((event) => {
          switch (event.event) {
            case 'Started':
              contentLength = event.data.contentLength || 0;
              console.log(`started downloading ${contentLength} bytes`);
              break;
            case 'Progress':
              downloaded += event.data.chunkLength;
              console.log(`downloaded ${downloaded} from ${contentLength}`);
              break;
            case 'Finished':
              console.log('download finished');
              showToast("Unduhan selesai! Memulai ulang aplikasi...", "success");
              break;
          }
        });
        
        await relaunch();
      }
    } else {
      if (manualCheck) {
        showToast("Aplikasi Anda sudah dalam versi terbaru!", "success");
      }
    }
  } catch (err) {
    console.error("Failed to check for updates:", err);
    if (manualCheck) {
      showToast("Gagal mengecek update. Periksa koneksi internet Anda.", "error");
    }
  }
}
