use axum::{routing::{post, delete}, Json, Router};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::auth::extractor::AuthUser;
use crate::error::AppError;
use crate::ws::AppState;

pub fn router() -> Router<Arc<RwLock<AppState>>> {
    Router::new()
        .route("/", post(create_session))
        .route("/{id}", delete(close_session))
}

#[derive(Deserialize)]
pub struct CreateSessionRequest {
    pub device_id: String,
}

#[derive(Serialize)]
pub struct CreateSessionResponse {
    pub session_id: String,
    pub ws_url: String,
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

    // Verify user is connected via WebSocket
    {
        let sessions = state.web_hub.sessions.read().await;
        if !sessions.contains_key(&user.user_id) {
            return Err(AppError::BadRequest("web ui not connected via ws".into()));
        }
    }

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

    state.web_hub.session_registry.unregister(&id).await;
    state
        .store
        .close_session(&id)
        .await
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(serde_json::json!({ "message": "session closed" })))
}
