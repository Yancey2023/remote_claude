use axum::extract::{Path, State};
use axum::http::{header, HeaderMap};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::error::AppError;
use crate::ws::AppState;

#[derive(Serialize)]
pub struct DownloadFileInfo {
    pub filename: String,
    pub size: u64,
    pub modified: String,
    pub platform: Option<String>,
    pub arch: Option<String>,
    pub version: Option<String>,
}

#[derive(Serialize)]
pub struct DownloadListResponse {
    pub files: Vec<DownloadFileInfo>,
}

pub fn router() -> Router<Arc<RwLock<AppState>>> {
    // Installers on new devices have no browser session. Only download assets
    // are public; device registration still requires a client token.
    Router::new()
        .route("/", get(list_downloads))
        .route("/sizes", get(download_sizes))
        .route("/{*filename}", get(download_file))
}

/// GET /api/downloads/sizes — returns filename → size mapping for all client binaries.
async fn download_sizes(
    State(state): State<Arc<RwLock<AppState>>>,
) -> Result<Json<HashMap<String, u64>>, AppError> {
    let config = {
        let s = state.read().await;
        s.config.downloads_dir.clone()
    };

    let dir = PathBuf::from(&config);
    if !dir.exists() || !dir.is_dir() {
        return Ok(Json(HashMap::new()));
    }

    let mut sizes = HashMap::new();
    let mut read_dir = tokio::fs::read_dir(&dir)
        .await
        .map_err(|e| AppError::Internal(format!("failed to read downloads dir: {}", e)))?;

    while let Some(entry) = read_dir
        .next_entry()
        .await
        .map_err(|e| AppError::Internal(format!("failed to read entry: {}", e)))?
    {
        let metadata = entry
            .metadata()
            .await
            .map_err(|e| AppError::Internal(format!("failed to get metadata: {}", e)))?;

        if metadata.is_file() {
            let filename = entry.file_name().to_string_lossy().to_string();
            sizes.insert(filename, metadata.len());
        }
    }

    Ok(Json(sizes))
}

/// GET /api/downloads — list available client binaries
async fn list_downloads(
    State(state): State<Arc<RwLock<AppState>>>,
) -> Result<Json<DownloadListResponse>, AppError> {
    let config = {
        let s = state.read().await;
        s.config.downloads_dir.clone()
    };

    let dir = PathBuf::from(&config);
    if !dir.exists() || !dir.is_dir() {
        return Ok(Json(DownloadListResponse { files: vec![] }));
    }

    let mut files = Vec::new();
    let mut read_dir = tokio::fs::read_dir(&dir)
        .await
        .map_err(|e| AppError::Internal(format!("failed to read downloads dir: {}", e)))?;

    while let Some(entry) = read_dir
        .next_entry()
        .await
        .map_err(|e| AppError::Internal(format!("failed to read entry: {}", e)))?
    {
        let metadata = entry
            .metadata()
            .await
            .map_err(|e| AppError::Internal(format!("failed to get metadata: {}", e)))?;

        if metadata.is_file() {
            let filename = entry.file_name().to_string_lossy().to_string();
            let modified = metadata
                .modified()
                .ok()
                .and_then(|t| {
                    let duration = t.duration_since(std::time::UNIX_EPOCH).ok()?;
                    let secs = duration.as_secs();
                    chrono::DateTime::from_timestamp(secs as i64, 0).map(|dt| dt.to_rfc3339())
                })
                .unwrap_or_default();

            let (platform, arch, version) = parse_filename(&filename);

            files.push(DownloadFileInfo {
                filename,
                size: metadata.len(),
                modified,
                platform,
                arch,
                version,
            });
        }
    }

    files.sort_by(|a, b| a.filename.cmp(&b.filename));

    Ok(Json(DownloadListResponse { files }))
}

/// GET /api/downloads/{filename} — download a client binary
async fn download_file(
    Path(filename): Path<String>,
    State(state): State<Arc<RwLock<AppState>>>,
) -> Result<Response, AppError> {
    let config = {
        let s = state.read().await;
        s.config.downloads_dir.clone()
    };

    // Only serve a single filename from the public downloads directory.
    let sanitized = filename.as_str();
    if !is_valid_filename(sanitized) {
        return Err(AppError::BadRequest("invalid filename".into()));
    }

    let file_path = PathBuf::from(&config).join(sanitized);

    let metadata = tokio::fs::symlink_metadata(&file_path).await;
    if !metadata.is_ok_and(|metadata| metadata.is_file()) {
        return Err(AppError::NotFound("file not found".into()));
    }

    let data = tokio::fs::read(&file_path)
        .await
        .map_err(|e| AppError::Internal(format!("failed to read file: {}", e)))?;

    let content_type = if sanitized.ends_with(".exe") {
        "application/vnd.microsoft.portable-executable"
    } else if sanitized.ends_with(".zip") {
        "application/zip"
    } else if sanitized.ends_with(".gz") || sanitized.ends_with(".tgz") {
        "application/gzip"
    } else {
        "application/octet-stream"
    };

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, content_type.parse().unwrap());
    headers.insert(
        header::CONTENT_DISPOSITION,
        format!("attachment; filename=\"{}\"", sanitized)
            .parse()
            .unwrap(),
    );
    headers.insert(
        header::CONTENT_LENGTH,
        data.len().to_string().parse().unwrap(),
    );

    Ok((headers, data).into_response())
}

fn is_valid_filename(filename: &str) -> bool {
    !filename.is_empty()
        && !filename.contains("..")
        && !filename
            .chars()
            .any(|c| c.is_control() || matches!(c, '/' | '\\' | ':' | '"'))
}

/// Parse a client binary filename to extract version, platform, and architecture.
///
/// Expected patterns:
/// - `remote-claude-desktop-client-<version>-<os>-<arch>`
/// - `remote-claude-desktop-client-<version>-<os>-<arch>-<variant>` (e.g. ubuntu22)
/// - `remote-claude-desktop-client-<version>-<os>-<arch>.exe`
fn parse_filename(filename: &str) -> (Option<String>, Option<String>, Option<String>) {
    let name = filename.strip_suffix(".exe").unwrap_or(filename);
    let parts: Vec<&str> = name.split('-').collect();

    // Must start with "remote-claude-desktop-client"
    if parts.len() < 7
        || parts[0] != "remote"
        || parts[1] != "claude"
        || parts[2] != "desktop"
        || parts[3] != "client"
    {
        return (None, None, None);
    }

    let version = Some(parts[4].to_string());
    let platform = Some(parts[5].to_string());
    let arch = if parts.len() > 7 {
        // e.g. "x64-ubuntu22" — join the remaining parts
        Some(parts[6..].join("-"))
    } else {
        Some(parts[6].to_string())
    };

    (platform, arch, version)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::rate_limit::LoginRateLimiter;
    use crate::config::Config;
    use crate::ws::{client_hub::ClientHub, web_hub::WebHub};
    use axum::body::{to_bytes, Body};
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    const BINARY: &str = "remote-claude-desktop-client-v1.2.2-linux-x64";

    struct TestDownloads(PathBuf);

    impl Drop for TestDownloads {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(self.0.join(BINARY));
            let _ = std::fs::remove_dir(&self.0);
        }
    }

    async fn test_app() -> (Router, TestDownloads) {
        let dir = TestDownloads(
            std::env::temp_dir().join(format!("downloads-test-{}", uuid::Uuid::new_v4())),
        );
        tokio::fs::create_dir(&dir.0).await.unwrap();
        tokio::fs::write(dir.0.join(BINARY), b"test client binary")
            .await
            .unwrap();
        let config = Config {
            admin_user: "admin".into(),
            admin_pass: "test".into(),
            jwt_secret: "test-secret".into(),
            database_url: "sqlite::memory:".into(),
            host: "127.0.0.1".into(),
            port: 0,
            jwt_expiry_hours: 24,
            heartbeat_interval_secs: 15,
            heartbeat_timeout_secs: 30,
            allowed_origin: String::new(),
            downloads_dir: dir.0.to_string_lossy().into_owned(),
        };
        let state = Arc::new(RwLock::new(AppState {
            jwt_secret: Arc::new(config.jwt_secret.clone()),
            store: crate::store::SqliteStore::new(&config.database_url)
                .await
                .unwrap(),
            config: Arc::new(config),
            client_hub: ClientHub::new(),
            web_hub: WebHub::new(),
            login_rate_limiter: LoginRateLimiter::new(10, 300),
            ws_rate_limiter: Arc::new(LoginRateLimiter::new(30, 60)),
            register_rate_limiter: Arc::new(LoginRateLimiter::new(5, 60)),
            pending_dir_requests: Arc::new(std::sync::Mutex::new(HashMap::new())),
        }));
        (crate::api::router().with_state(state), dir)
    }

    #[tokio::test]
    async fn anonymous_install_can_read_downloads() {
        let (app, _dir) = test_app().await;
        for path in [
            "/api/downloads".to_string(),
            "/api/downloads/sizes".into(),
            format!("/api/downloads/{BINARY}"),
        ] {
            // A fresh device sends neither an Authorization header nor a cookie.
            let response = app
                .clone()
                .oneshot(Request::get(&path).body(Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK, "{path}");
            if path.ends_with(BINARY) {
                assert_eq!(
                    response.headers()[header::CONTENT_TYPE],
                    "application/octet-stream"
                );
                assert_eq!(
                    response.headers()[header::CONTENT_DISPOSITION],
                    format!("attachment; filename=\"{BINARY}\"")
                );
                assert_eq!(
                    to_bytes(response.into_body(), 1024).await.unwrap(),
                    &b"test client binary"[..]
                );
            } else {
                let body = to_bytes(response.into_body(), 4096).await.unwrap();
                let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
                if path.ends_with("sizes") {
                    assert_eq!(json[BINARY], 18);
                } else {
                    assert_eq!(json["files"][0]["filename"], BINARY);
                }
            }
        }
    }

    #[tokio::test]
    async fn anonymous_download_errors_and_protected_apis() {
        let (app, _dir) = test_app().await;
        for (path, status) in [
            ("/api/downloads/missing", StatusCode::NOT_FOUND),
            ("/api/downloads/..%2Fsecret", StatusCode::BAD_REQUEST),
            ("/api/downloads/nested/file", StatusCode::BAD_REQUEST),
            ("/api/downloads/C%3Asecret", StatusCode::BAD_REQUEST),
            ("/api/downloads/bad%22name", StatusCode::BAD_REQUEST),
            ("/api/devices", StatusCode::UNAUTHORIZED),
            ("/api/tokens", StatusCode::UNAUTHORIZED),
            ("/api/sessions", StatusCode::UNAUTHORIZED),
        ] {
            let response = app
                .clone()
                .oneshot(Request::get(path).body(Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(response.status(), status, "{path}");
        }
    }

    #[test]
    fn test_parse_filename_linux_x64() {
        let (platform, arch, version) =
            parse_filename("remote-claude-desktop-client-v1.1.0-linux-x64");
        assert_eq!(platform.as_deref(), Some("linux"));
        assert_eq!(arch.as_deref(), Some("x64"));
        assert_eq!(version.as_deref(), Some("v1.1.0"));
    }

    #[test]
    fn test_parse_filename_linux_x64_ubuntu22() {
        let (platform, arch, version) =
            parse_filename("remote-claude-desktop-client-v1.1.0-linux-x64-ubuntu22");
        assert_eq!(platform.as_deref(), Some("linux"));
        assert_eq!(arch.as_deref(), Some("x64-ubuntu22"));
        assert_eq!(version.as_deref(), Some("v1.1.0"));
    }

    #[test]
    fn test_parse_filename_windows_x64() {
        let (platform, arch, version) =
            parse_filename("remote-claude-desktop-client-v1.1.0-windows-x64.exe");
        assert_eq!(platform.as_deref(), Some("windows"));
        assert_eq!(arch.as_deref(), Some("x64"));
        assert_eq!(version.as_deref(), Some("v1.1.0"));
    }

    #[test]
    fn test_parse_filename_unrecognized() {
        let (platform, arch, version) = parse_filename("random-file.zip");
        assert!(platform.is_none());
        assert!(arch.is_none());
        assert!(version.is_none());
    }

    #[test]
    fn test_filename_sanitization_rejects_traversal() {
        assert!(is_valid_filename(
            "remote-claude-desktop-client-v1.2.0-linux-x64"
        ));
        for filename in [
            "../etc/passwd",
            "foo/../../etc/passwd",
            "..\\windows\\system32",
            "",
            "/binary",
            "nested/binary",
            "C:binary",
            "binary:stream",
            "bad\"name",
            "bad\r\nname",
            "..\\..\\windows\\system32",
        ] {
            assert!(!is_valid_filename(filename), "accepted {filename:?}");
        }
    }
}
