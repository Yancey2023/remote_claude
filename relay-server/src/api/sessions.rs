use axum::{routing::{post, get}, Json, Router};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::auth::extractor::AuthUser;
use crate::error::AppError;
use crate::ws::AppState;

pub fn router() -> Router<Arc<RwLock<AppState>>> {
    Router::new()
        .route("/", post(create_session).get(list_sessions))
        .route("/{id}", get(get_session).delete(close_session))
}

#[derive(Deserialize)]
pub struct CreateSessionRequest {
    pub device_id: String,
    pub cwd: Option<String>,
}

#[derive(Serialize)]
pub struct CreateSessionResponse {
    pub session_id: String,
    pub ws_url: String,
}

#[derive(Serialize)]
pub struct SessionInfo {
    pub id: String,
    pub device_id: String,
    pub user_id: String,
    pub created_at: i64,
    pub cwd: Option<String>,
}

async fn create_session(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
    Json(req): Json<CreateSessionRequest>,
) -> Result<Json<CreateSessionResponse>, AppError> {
    let state = state.read().await;

    // Verify device exists and is online
    let device = state
        .client_hub
        .get_by_device_id(&req.device_id)
        .await
        .ok_or(AppError::NotFound("device not found or offline".into()))?;

    // Create session actor
    let session = crate::ws::session::SessionActor::new(
        device.id.clone(),
        user.user_id.clone(),
    );
    let session_id = session.id.clone();

    state.web_hub.session_registry.register(session).await;

    // Store in persistence
    let db_session = crate::models::Session::new(
        session_id.clone(),
        req.device_id.clone(),
        user.user_id.clone(),
        req.cwd.clone(),
    );
    state
        .store
        .create_session(db_session)
        .await
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(CreateSessionResponse {
        session_id,
        ws_url: format!("/ws/web"),
    }))
}

async fn list_sessions(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
) -> Json<Vec<SessionInfo>> {
    let state = state.read().await;
    let sessions = state.store.list_sessions(&user.user_id).await;

    // Auto-clean stale sessions that are no longer present in active WS registry.
    let mut stale_ids = Vec::new();
    let mut visible = Vec::new();
    for s in sessions {
        if state.web_hub.session_registry.get(&s.id).await.is_none() {
            stale_ids.push(s.id);
            continue;
        }
        visible.push(SessionInfo {
            id: s.id,
            device_id: s.device_id,
            user_id: s.user_id,
            created_at: s.created_at,
            cwd: s.cwd,
        });
    }

    for id in stale_ids {
        let _ = state.store.close_session(&id).await;
    }

    Json(visible)
}

async fn get_session(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<SessionInfo>, AppError> {
    let state = state.read().await;
    let s = state
        .store
        .get_session(&id)
        .await
        .ok_or(AppError::NotFound("session not found".into()))?;

    if s.user_id != user.user_id && !user.is_admin() {
        return Err(AppError::Forbidden("not your session".into()));
    }

    Ok(Json(SessionInfo {
        id: s.id,
        device_id: s.device_id,
        user_id: s.user_id,
        created_at: s.created_at,
        cwd: s.cwd,
    }))
}

async fn close_session(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let state = state.read().await;

    // Verify session belongs to user
    let session = state
        .web_hub
        .session_registry
        .get(&id)
        .await
        .ok_or(AppError::NotFound("session not found".into()))?;

    if session.user_id != user.user_id && !user.is_admin() {
        return Err(AppError::Forbidden("not your session".into()));
    }

    // Notify device to kill PTY session
    let close_msg = serde_json::json!({
        "type": "session_closed",
        "payload": { "session_id": &session.id }
    });
    let _ = state.client_hub.send_to_device(&session.device_id, &close_msg.to_string()).await;

    state.web_hub.session_registry.unregister(&id).await;
    // DB close may fail if session was WS-created before migration; non-fatal
    let _ = state.store.close_session(&id).await;

    Ok(Json(serde_json::json!({ "message": "session closed" })))
}
