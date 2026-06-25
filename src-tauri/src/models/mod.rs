use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub r2: R2Config,
    pub gdrive: GDriveConfig,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            r2: R2Config {
                account_id: String::new(),
                access_key_id: String::new(),
                secret_access_key: String::new(),
                bucket_name: String::new(),
            },
            gdrive: GDriveConfig {
                client_id: String::new(),
                client_secret: String::new(),
                refresh_token: String::new(),
            },
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct R2Config {
    pub account_id: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub bucket_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GDriveConfig {
    pub client_id: String,
    pub client_secret: String,
    pub refresh_token: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MediaItem {
    pub id: String,
    pub title: String,
    pub description: String,
    pub thumbnail_url: String,
    pub media_type: String, // "Movie" | "Series"
    pub seasons: Vec<Season>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Season {
    pub id: String,
    pub name: String, // e.g. "Doraemon Classic Movies", "Season 1"
    pub episodes: Vec<Episode>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Episode {
    pub id: String,
    pub title: String,
    pub source: VideoSource,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum VideoSource {
    CloudflareR2 {
        key: String,
    },
    GoogleDrive {
        file_id: String,
    },
    WebEmbed {
        embed_url: String,
    },
}