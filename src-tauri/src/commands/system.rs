/// Fungsi asinkronus sederhana untuk memastikan komunikasi frontend-backend berjalan lancar.
/// Menerapkan protokol penanganan error yang aman dengan mengembalikan Result.
#[tauri::command]
pub async fn ping_backend(message: String) -> Result<String, String> {
    if message.trim().is_empty() {
        return Err("Pesan dari frontend tidak boleh kosong.".to_string());
    }
    
    // Simulasi respons sukses tanpa risiko panic
    Ok(format!("Koneksi Aman Terjalin! Backend menerima pesan: '{}'", message))
}

#[tauri::command]
pub async fn fetch_byse_files_rust(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let res = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("Gagal menghubungi API: {}", e))?;
        
    let body = res.text()
        .await
        .map_err(|e| format!("Gagal membaca data API: {}", e))?;
        
    Ok(body)
}