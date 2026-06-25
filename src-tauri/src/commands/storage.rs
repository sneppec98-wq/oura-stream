use std::fs::{create_dir_all, File};
use std::io::{Read, Write};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use crate::models::{AppSettings, MediaItem};

fn get_storage_path(app: &AppHandle, filename: &str) -> Result<PathBuf, String> {
    let mut path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !path.exists() {
        create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    path.push(filename);
    Ok(path)
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<AppSettings, String> {
    let path = get_storage_path(&app, "settings.json")?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).map_err(|e| e.to_string())?;
    
    let settings: AppSettings = serde_json::from_str(&contents).unwrap_or_else(|_| AppSettings::default());
    Ok(settings)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = get_storage_path(&app, "settings.json")?;
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    
    let mut file = File::create(path).map_err(|e| e.to_string())?;
    file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_library(app: AppHandle) -> Result<Vec<MediaItem>, String> {
    let path = get_storage_path(&app, "library.json")?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).map_err(|e| e.to_string())?;
    
    let library: Vec<MediaItem> = serde_json::from_str(&contents).unwrap_or_else(|_| Vec::new());
    Ok(library)
}

#[tauri::command]
pub fn save_library(app: AppHandle, library: Vec<MediaItem>) -> Result<(), String> {
    let path = get_storage_path(&app, "library.json")?;
    let json = serde_json::to_string_pretty(&library).map_err(|e| e.to_string())?;
    
    let mut file = File::create(path).map_err(|e| e.to_string())?;
    file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}
