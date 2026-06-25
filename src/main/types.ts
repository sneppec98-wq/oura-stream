export interface LogEntry {
  timestamp: string;
  type: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export interface AppSettings {
  r2: {
    account_id: string;
    access_key_id: string;
    secret_access_key: string;
    bucket_name: string;
  };
  gdrive: {
    client_id: string;
    client_secret: string;
    refresh_token: string;
  };
}

export interface WatchProgress {
  filmId: string;
  episodeId: string;
  currentTime: number;
  duration: number;
  timestamp: number;
}
