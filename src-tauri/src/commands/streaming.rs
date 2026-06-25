use std::sync::Mutex;
use std::time::{SystemTime};
use std::thread;
use tauri::{AppHandle, State, Manager};
use tiny_http::{Server, Response, Request, Header};
use crate::models::R2Config;
use crate::commands::storage::load_settings;
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use chrono::Utc;

type HmacSha256 = Hmac<Sha256>;

pub struct AppState {
    pub proxy_port: Mutex<Option<u16>>,
    pub gdrive_token: Mutex<Option<(String, SystemTime)>>,
}

fn sign(key: &[u8], msg: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC can take key of any size");
    mac.update(msg);
    mac.finalize().into_bytes().to_vec()
}

fn percent_encode_query(val: &str) -> String {
    url::form_urlencoded::byte_serialize(val.as_bytes())
        .collect::<String>()
        .replace('+', "%20")
        .replace('*', "%2A")
        .replace("%7E", "~")
}

fn percent_encode_path(path: &str) -> String {
    path.split('/')
        .map(|segment| {
            url::form_urlencoded::byte_serialize(segment.as_bytes())
                .collect::<String>()
                .replace('+', "%20")
                .replace('*', "%2A")
                .replace("%7E", "~")
        })
        .collect::<Vec<String>>()
        .join("/")
}

pub fn sign_r2_url(
    r2: &R2Config,
    key: &str,
    expires_in_secs: u64,
) -> Result<String, String> {
    if r2.account_id.is_empty() || r2.access_key_id.is_empty() || r2.secret_access_key.is_empty() || r2.bucket_name.is_empty() {
        return Err("R2 credentials not configured".to_string());
    }

    let method = "GET";
    let host = format!("{}.r2.cloudflarestorage.com", r2.account_id);
    let region = "auto";
    let service = "s3";
    
    let object_path = if key.starts_with('/') {
        key.to_string()
    } else {
        format!("/{}", key)
    };
    
    let encoded_path = percent_encode_path(&object_path);
    let path = format!("/{}/{}", r2.bucket_name, encoded_path.trim_start_matches('/'));
    
    let now = Utc::now();
    let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
    let datestamp = now.format("%Y%m%d").to_string();
    
    let credential_scope = format!("{}/{}/{}/aws4_request", datestamp, region, service);
    
    let algorithm = "AWS4-HMAC-SHA256";
    let signed_headers = "host";
    
    let mut query_params = vec![
        ("X-Amz-Algorithm", algorithm.to_string()),
        ("X-Amz-Credential", format!("{}/{}", r2.access_key_id, credential_scope)),
        ("X-Amz-Date", amz_date.clone()),
        ("X-Amz-Expires", expires_in_secs.to_string()),
        ("X-Amz-SignedHeaders", signed_headers.to_string()),
    ];
    
    query_params.sort_by(|a, b| a.0.cmp(b.0));
    
    let canonical_query_string = query_params.iter()
        .map(|(k, v)| {
            let enc_k = percent_encode_query(k);
            let enc_v = percent_encode_query(v);
            format!("{}={}", enc_k, enc_v)
        })
        .collect::<Vec<String>>()
        .join("&");
        
    let canonical_headers = format!("host:{}\n", host);
    let payload_hash = "UNSIGNED-PAYLOAD";
    
    let canonical_request = format!(
        "{}\n{}\n{}\n{}\n{}\n{}",
        method,
        path,
        canonical_query_string,
        canonical_headers,
        signed_headers,
        payload_hash
    );
    
    let mut hasher = Sha256::new();
    hasher.update(canonical_request.as_bytes());
    let canonical_request_hash = hex::encode(hasher.finalize());
    
    let string_to_sign = format!(
        "{}\n{}\n{}\n{}",
        algorithm,
        amz_date,
        credential_scope,
        canonical_request_hash
    );
    
    let k_secret = format!("AWS4{}", r2.secret_access_key);
    let k_date = sign(k_secret.as_bytes(), datestamp.as_bytes());
    let k_region = sign(&k_date, region.as_bytes());
    let k_service = sign(&k_region, service.as_bytes());
    let k_signing = sign(&k_service, b"aws4_request");
    
    let signature = hex::encode(sign(&k_signing, string_to_sign.as_bytes()));
    
    let final_url = format!(
        "https://{}{}?{}&X-Amz-Signature={}",
        host,
        path,
        canonical_query_string,
        signature
    );
    
    Ok(final_url)
}

fn get_access_token(app: &AppHandle, state: &State<'_, AppState>) -> Result<String, String> {
    {
        let token_guard = state.gdrive_token.lock().unwrap();
        if let Some((token, expiry)) = &*token_guard {
            if let Ok(duration) = expiry.duration_since(SystemTime::now()) {
                if duration.as_secs() > 300 {
                    return Ok(token.clone());
                }
            }
        }
    }
    
    let settings = load_settings(app.clone())?;
    let gdrive = settings.gdrive;
    if gdrive.client_id.is_empty() || gdrive.client_secret.is_empty() || gdrive.refresh_token.is_empty() {
        return Err("Kredensial Google Drive belum dikonfigurasi di Pengaturan.".to_string());
    }
    
    let client = reqwest::blocking::Client::new();
    let params = [
        ("client_id", &gdrive.client_id),
        ("client_secret", &gdrive.client_secret),
        ("refresh_token", &gdrive.refresh_token),
        ("grant_type", &"refresh_token".to_string()),
    ];
    
    let res = client.post("https://oauth2.googleapis.com/token")
        .form(&params)
        .send()
        .map_err(|e| format!("Gagal menghubungi Google Auth API: {}", e))?;
        
    if !res.status().is_success() {
        let err_body = res.text().unwrap_or_default();
        return Err(format!("Google Auth Error: {}", err_body));
    }
    
    #[derive(serde::Deserialize)]
    struct TokenResponse {
        access_token: String,
        expires_in: u64,
    }
    
    let token_data: TokenResponse = res.json()
        .map_err(|e| format!("Gagal memparsing token response: {}", e))?;
        
    let access_token = token_data.access_token;
    let expiry = SystemTime::now() + std::time::Duration::from_secs(token_data.expires_in);
    
    {
        let mut token_guard = state.gdrive_token.lock().unwrap();
        *token_guard = Some((access_token.clone(), expiry));
    }
    
    Ok(access_token)
}

fn stream_gdrive(app: AppHandle, request: Request, file_id: &str) -> Result<(), String> {
    let state = app.state::<AppState>();
    let access_token = match get_access_token(&app, &state) {
        Ok(t) => t,
        Err(e) => {
            let response = Response::from_string(format!("Error: {}", e)).with_status_code(400);
            let _ = request.respond(response);
            return Err(e);
        }
    };
    
    let mut range_header = None;
    for h in request.headers() {
        if h.field.to_string().eq_ignore_ascii_case("range") {
            range_header = Some(h.value.clone());
            break;
        }
    }
    
    let client = reqwest::blocking::Client::new();
    let url = format!("https://www.googleapis.com/drive/v3/files/{}?alt=media", file_id);
    let mut req = client.get(&url)
        .header("Authorization", format!("Bearer {}", access_token));
        
    if let Some(r) = range_header {
        req = req.header("Range", r.to_string());
    }
    
    let res = req.send().map_err(|e| format!("Request to Google Drive failed: {}", e))?;
    let status_code = res.status().as_u16();
    
    // Collect all header values as owned Strings before consuming `res`
    let content_length: Option<usize> = res.headers()
        .get(reqwest::header::CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<usize>().ok());
        
    let content_type: String = res.headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("video/mp4")
        .to_owned();
        
    let content_range: Option<String> = res.headers()
        .get("content-range")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_owned());
        
    // Now consume `res` — no borrows remain on it
    let mut response = Response::new(
        tiny_http::StatusCode(status_code),
        vec![],
        res,
        content_length,
        None
    );
    
    response.add_header(Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap());
    response.add_header(Header::from_bytes(&b"Accept-Ranges"[..], &b"bytes"[..]).unwrap());
    response.add_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap());
    
    if let Some(cr) = content_range {
        response.add_header(Header::from_bytes(&b"Content-Range"[..], cr.as_bytes()).unwrap());
    }
    
    request.respond(response).map_err(|e| e.to_string())?;
    Ok(())
}

fn handle_request(app: AppHandle, request: Request) {
    let url_str = format!("http://localhost{}", request.url());
    let parsed_url = match url::Url::parse(&url_str) {
        Ok(u) => u,
        Err(_) => {
            let response = Response::from_string("Invalid URL").with_status_code(400);
            let _ = request.respond(response);
            return;
        }
    };
    
    if parsed_url.path() == "/stream/gdrive" {
        let file_id = parsed_url.query_pairs()
            .find(|(k, _)| k == "id")
            .map(|(_, v)| v.into_owned());
            
        let file_id = match file_id {
            Some(id) if !id.is_empty() => id,
            _ => {
                let response = Response::from_string("Missing file id").with_status_code(400);
                let _ = request.respond(response);
                return;
            }
        };
        
        if let Err(e) = stream_gdrive(app, request, &file_id) {
            eprintln!("GDrive streaming error: {}", e);
        }
    } else if parsed_url.path() == "/auth-callback" {
        use tauri::Emitter;
        let token = parsed_url.query_pairs()
            .find(|(k, _)| k == "token")
            .map(|(_, v)| v.into_owned());
            
        if let Some(t) = token {
            let _ = app.emit("auth-success", t);
            
            let html = r#"
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Login Sukses</title>
                    <style>
                        body { font-family: sans-serif; text-align: center; padding: 50px; background: #080c14; color: #fff; }
                        .card { max-width: 400px; margin: 0 auto; background: #0e1421; padding: 30px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
                        h1 { color: #7c3aed; margin-top: 0; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Login Sukses!</h1>
                        <p>Anda telah berhasil masuk ke Oura Stream. Silakan tutup tab ini dan kembali ke aplikasi desktop.</p>
                    </div>
                </body>
                </html>
            "#;
            let response = Response::from_string(html)
                .with_header(Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap());
            let _ = request.respond(response);
        } else {
            let response = Response::from_string("Missing token").with_status_code(400);
            let _ = request.respond(response);
        }
    } else {
        let response = Response::from_string("Not Found").with_status_code(404);
        let _ = request.respond(response);
    }
}

pub fn start_proxy(app_handle: AppHandle) -> Result<u16, String> {
    let server = Server::http("127.0.0.1:0")
        .map_err(|e| format!("Gagal menjalankan proxy server: {}", e))?;
        
    let port = server.server_addr().to_ip().unwrap().port();
    
    {
        let state = app_handle.state::<AppState>();
        let mut port_guard = state.proxy_port.lock().unwrap();
        *port_guard = Some(port);
    }
    
    let app_clone = app_handle.clone();
    thread::spawn(move || {
        for request in server.incoming_requests() {
            let app = app_clone.clone();
            thread::spawn(move || {
                handle_request(app, request);
            });
        }
    });
    
    Ok(port)
}

#[tauri::command]
pub fn get_proxy_port(state: State<'_, AppState>) -> Result<u16, String> {
    let port_guard = state.proxy_port.lock().unwrap();
    port_guard.ok_or_else(|| "Proxy server belum berjalan".to_string())
}

#[tauri::command]
pub fn get_stream_url(
    app: AppHandle,
    state: State<'_, AppState>,
    media_type: String,
    key_or_id: String,
) -> Result<String, String> {
    match media_type.as_str() {
        "CloudflareR2" => {
            let settings = load_settings(app)?;
            sign_r2_url(&settings.r2, &key_or_id, 3600)
        }
        "GoogleDrive" => {
            let port_guard = state.proxy_port.lock().unwrap();
            let port = port_guard.ok_or_else(|| "Proxy server belum berjalan".to_string())?;
            Ok(format!("http://127.0.0.1:{}/stream/gdrive?id={}", port, key_or_id))
        }
        "WebEmbed" => {
            Ok(key_or_id)
        }
        _ => Err(format!("Tipe media tidak didukung: {}", media_type)),
    }
}

#[tauri::command]
pub fn test_r2_connection(app: AppHandle) -> Result<String, String> {
    let settings = load_settings(app)?;
    let r2 = settings.r2;
    if r2.account_id.is_empty() || r2.access_key_id.is_empty() || r2.secret_access_key.is_empty() || r2.bucket_name.is_empty() {
        return Err("R2 credentials not configured".to_string());
    }
    
    let url = sign_r2_url(&r2, "connection_test_file_temp_123.txt", 60)?;
    
    let client = reqwest::blocking::Client::new();
    let res = client.head(&url)
        .send()
        .map_err(|e| format!("HEAD request failed: {}", e))?;
        
    let status = res.status();
    if status.is_success() || status.as_u16() == 404 {
        Ok("Koneksi R2 berhasil!".to_string())
    } else {
        let err_msg = format!("R2 Connection failed with status {}: {:?}", status.as_u16(), status.canonical_reason());
        Err(err_msg)
    }
}

#[tauri::command]
pub fn test_gdrive_connection(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    match get_access_token(&app, &state) {
        Ok(_) => Ok("Koneksi Google Drive berhasil! Token OAuth berhasil diperbarui.".to_string()),
        Err(e) => Err(format!("Koneksi Google Drive gagal: {}", e)),
    }
}
