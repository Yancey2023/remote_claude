use axum::{routing::{delete, get}, Json, Router};
use serde::Serialize;
use std::collections::HashSet;
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
    pub username: String,
}

async fn list_devices(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
) -> Json<Vec<DeviceResponse>> {
    let state = state.read().await;

    // Every user only sees their own devices
    let store_devices = state.store.list_devices(Some(&user.user_id)).await;

    let online_ids: HashSet<String> = state.client_hub.list_online().await
        .into_iter().map(|e| e.id).collect();

    let mut result = Vec::with_capacity(store_devices.len());
    for d in store_devices {
        let online = online_ids.contains(&d.id);
        result.push(DeviceResponse {
            id: d.id,
            name: d.name,
            version: d.version,
            online,
            busy: d.busy,
            last_seen: d.last_seen,
            user_id: d.user_id,
            username: d.username,
        });
    }

    Json(result)
}

async fn delete_device(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = state.read().await;

    // Kick and unregister from hub if online
    state.client_hub.kick_and_unregister(&id).await;

    // Delete only if it belongs to the current user (single query)
    state
        .store
        .delete_user_device(&id, &user.user_id)
        .await
        .map_err(|_| AppError::Forbidden("not your device".into()))?;

    Ok(Json(serde_json::json!({ "message": "device deleted" })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_response_serialization() {
        let resp = DeviceResponse {
            id: "dev-1".into(),
            name: "my-pc".into(),
            version: "1.0".into(),
            online: true,
            busy: false,
            last_seen: 1700000000,
            user_id: "user-42".into(),
            username: "alice".into(),
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["id"], "dev-1");
        assert_eq!(json["name"], "my-pc");
        assert_eq!(json["online"], true);
        assert_eq!(json["user_id"], "user-42");
        assert_eq!(json["username"], "alice");
    }

    #[test]
    fn test_device_response_offline() {
        let resp = DeviceResponse {
            id: "dev-2".into(),
            name: "offline-pc".into(),
            version: "0.5".into(),
            online: false,
            busy: false,
            last_seen: 1690000000,
            user_id: String::new(),
            username: String::new(),
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["online"], false);
        assert_eq!(json["user_id"], "");
    }
}
