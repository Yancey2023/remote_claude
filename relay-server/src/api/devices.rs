use axum::{routing::get, Json, Router};
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::auth::extractor::AuthUser;
use crate::ws::AppState;

pub fn router() -> Router<Arc<RwLock<AppState>>> {
    Router::new().route("/", get(list_devices))
}

#[derive(Serialize)]
pub struct DeviceResponse {
    pub id: String,
    pub name: String,
    pub version: String,
    pub online: bool,
    pub busy: bool,
    pub last_seen: i64,
}

async fn list_devices(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    _user: AuthUser,
) -> Json<Vec<DeviceResponse>> {
    let state = state.read().await;
    let store_devices = state.store.list_devices().await;

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
            });
        }
    }

    Json(result)
}
