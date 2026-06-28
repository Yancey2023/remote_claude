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

use crate::auth::extractor::AuthUser;
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
    Router::new()
        .route("/", get(list_downloads))
        .route("/sizes", get(download_sizes))
        .route("/{*filename}", get(download_file))
}

/// GET /api/downloads/sizes — returns filename → size mapping for all client binaries.
async fn download_sizes(
    State(state): State<Arc<RwLock<AppState>>>,
    _user: AuthUser,
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
    _user: AuthUser,
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
                    chrono::DateTime::from_timestamp(secs as i64, 0)
                        .map(|dt| dt.to_rfc3339())
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
    _user: AuthUser,
) -> Result<Response, AppError> {
    let config = {
        let s = state.read().await;
        s.config.downloads_dir.clone()
    };

    // Sanitize: strip leading slashes, reject path traversal
    let sanitized = filename.trim_start_matches('/');
    if sanitized.is_empty()
        || sanitized.contains("..")
        || sanitized.contains('\\')
    {
        return Err(AppError::BadRequest("invalid filename".into()));
    }

    let file_path = PathBuf::from(&config).join(sanitized);

    if !file_path.exists() || !file_path.is_file() {
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
    headers.insert(
        header::CONTENT_TYPE,
        content_type.parse().unwrap(),
    );
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

    #[test]
    fn test_parse_filename_linux_x64() {
        let (platform, arch, version) = parse_filename("remote-claude-desktop-client-v1.1.0-linux-x64");
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
}
