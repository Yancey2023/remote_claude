use axum::{routing::{delete, get}, Json, Router};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::auth::extractor::AuthUser;
use crate::error::AppError;
use crate::ws::AppState;

pub fn router() -> Router<Arc<RwLock<AppState>>> {
    Router::new()
        .route("/", get(list_devices))
        .route("/{id}", delete(delete_device))
}

#[derive(Serialize)]
pub struct DeviceResponse {
    pub id: String,
    pub name: String,
    pub version: String,
    pub online: bool,
    pub busy: bool,
    pub last_seen: i64,
    pub user_id: String,
}

async fn list_devices(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
) -> Json<Vec<DeviceResponse>> {
    let state = state.read().await;

    // Admin sees all devices; regular users only see their own
    let store_devices = if user.is_admin() {
        state.store.list_devices(None).await
    } else {
        state.store.list_devices(Some(&user.user_id)).await
    };

    // Merge with online status from hub
    let online_devices = state.client_hub.list_online().await;

    let mut result: Vec<DeviceResponse> = store_devices
        .into_iter()
        .map(|d| {
            let online = online_devices.iter().any(|o| o.id == d.id);
            DeviceResponse {
                id: d.id,
                name: d.name,
                version: d.version,
                online,
                busy: d.busy,
                last_seen: d.last_seen,
                user_id: d.user_id,
            }
        })
        .collect();

    // Also include online devices not yet in store (fresh connections)
    for od in &online_devices {
        if !result.iter().any(|r| r.id == od.id) {
            result.push(DeviceResponse {
                id: od.id.clone(),
                name: od.name.clone(),
                version: od.version.clone(),
                online: true,
                busy: false,
                last_seen: chrono::Utc::now().timestamp(),
                user_id: String::new(),
            });
        }
    }

    Json(result)
}

async fn delete_device(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = state.read().await;

    // Only owner or admin can delete
    if !user.is_admin() {
        let device = state.store.list_devices(Some(&user.user_id)).await;
        if !device.iter().any(|d| d.id == id) {
            return Err(AppError::Forbidden("not your device".into()));
        }
    }

    // If device is online, kick and unregister it from the hub
    state.client_hub.kick_and_unregister(&id).await;

    state
        .store
        .delete_device(&id)
        .await
        .map_err(|e| AppError::NotFound(e))?;

    Ok(Json(serde_json::json!({ "message": "device deleted" })))
}
