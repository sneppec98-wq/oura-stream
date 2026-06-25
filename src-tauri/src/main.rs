// Mencegah jendela konsol tambahan muncul pada OS Windows di mode rilis
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Deklarasi modul eksternal
pub mod commands;
pub mod models;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // Registrasi state global untuk port proxy dan cache token Google Drive
        .manage(commands::streaming::AppState {
            proxy_port: std::sync::Mutex::new(None),
            gdrive_token: std::sync::Mutex::new(None),
        })
        // Registrasi seluruh command secara modular dari modul commands
        .invoke_handler(tauri::generate_handler![
            commands::system::ping_backend,
            commands::system::fetch_byse_files_rust,
            commands::storage::load_library,
            commands::storage::save_library,
            commands::storage::load_settings,
            commands::storage::save_settings,
            commands::streaming::get_proxy_port,
            commands::streaming::get_stream_url,
            commands::streaming::test_r2_connection,
            commands::streaming::test_gdrive_connection
        ])
        .run(tauri::generate_context!())
        .expect("Gagal menjalankan aplikasi Tauri");
}