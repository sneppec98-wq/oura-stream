pub mod commands;
pub mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .manage(commands::streaming::AppState {
            proxy_port: std::sync::Mutex::new(None),
            gdrive_token: std::sync::Mutex::new(None),
        })
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
        .expect("error while running tauri application");
}
