use axum::{
    extract::Path,
    routing::{delete, get, patch, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::auth::extractor::AuthUser;
use crate::auth::password;
use crate::error::AppError;
use crate::models::{User, UserRole};
use crate::ws::AppState;

pub fn router() -> Router<Arc<RwLock<AppState>>> {
    Router::new()
        .route("/users", get(list_users).post(create_user))
        .route("/users/{id}", delete(delete_user))
        .route("/users/{id}/status", patch(toggle_user_status))
        .route("/users/{id}/password", post(reset_user_password))
        .route("/devices", get(list_all_devices))
        .route("/devices/{id}", delete(admin_delete_device))
        .route("/sessions", get(list_all_sessions))
        .route("/sessions/{id}", get(get_session_detail))
        .route("/tokens", post(generate_token))
}

#[derive(Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct UserResponse {
    pub id: String,
    pub username: String,
    pub role: String,
    pub enabled: bool,
    pub created_at: i64,
}

fn require_admin(user: &AuthUser) -> Result<(), AppError> {
    if !user.is_admin() {
        return Err(AppError::Forbidden("admin only".into()));
    }
    Ok(())
}

async fn list_users(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
) -> Result<Json<Vec<UserResponse>>, AppError> {
    require_admin(&user)?;
    let state = state.read().await;
    let users = state.store.list_users().await;
    Ok(Json(
        users
            .into_iter()
            .map(|u| UserResponse {
                id: u.id,
                username: u.username,
                role: u.role.as_str().to_string(),
                enabled: u.enabled,
                created_at: u.created_at,
            })
            .collect(),
    ))
}

async fn create_user(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
    Json(req): Json<CreateUserRequest>,
) -> Result<Json<UserResponse>, AppError> {
    require_admin(&user)?;

    if req.username.trim().is_empty() || req.password.len() < 6 {
        return Err(AppError::BadRequest(
            "username required and password min 6 chars".into(),
        ));
    }

    if req.username.len() > 64 || req.password.len() > 256 {
        return Err(AppError::BadRequest("input too long".into()));
    }

    let hash = password::hash_password(&req.password)
        .map_err(|e| AppError::Internal(e))?;

    let new_user = User::new(
        Uuid::new_v4().to_string(),
        req.username.trim().to_string(),
        hash,
        UserRole::User,
    );

    let resp = UserResponse {
        id: new_user.id.clone(),
        username: new_user.username.clone(),
        role: new_user.role.as_str().to_string(),
        enabled: new_user.enabled,
        created_at: new_user.created_at,
    };

    let state = state.read().await;
    state
        .store
        .create_user(new_user)
        .await
        .map_err(|e| AppError::Conflict(e))?;

    Ok(Json(resp))
}

async fn delete_user(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_admin(&user)?;

    let state = state.read().await;
    state
        .store
        .delete_user(&id)
        .await
        .map_err(|e| AppError::NotFound(e))?;

    Ok(Json(serde_json::json!({ "message": "user deleted" })))
}

#[derive(Deserialize)]
pub struct ToggleStatusRequest {
    pub enabled: bool,
}

async fn toggle_user_status(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(req): Json<ToggleStatusRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_admin(&user)?;

    let state = state.read().await;
    let mut u = state
        .store
        .get_user(&id)
        .await
        .ok_or(AppError::NotFound("user not found".into()))?;

    u.enabled = req.enabled;
    state
        .store
        .update_user(u)
        .await
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(serde_json::json!({ "message": "status updated" })))
}

// ── Password Reset ──

#[derive(Deserialize)]
pub struct ResetPasswordRequest {
    pub new_password: String,
}

async fn reset_user_password(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
    Path(id): Path<String>,
    Json(req): Json<ResetPasswordRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_admin(&user)?;

    if req.new_password.len() < 6 {
        return Err(AppError::BadRequest("password must be at least 6 characters".into()));
    }
    if req.new_password.len() > 256 {
        return Err(AppError::BadRequest("password too long".into()));
    }

    let state = state.read().await;
    let mut db_user = state
        .store
        .get_user(&id)
        .await
        .ok_or(AppError::NotFound("user not found".into()))?;

    let hash = password::hash_password(&req.new_password)
        .map_err(|e| AppError::Internal(e))?;

    db_user.password_hash = hash;
    state
        .store
        .update_user(db_user)
        .await
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(serde_json::json!({ "message": "password reset successfully" })))
}

// ── Device Management ──

#[derive(Serialize)]
pub struct AdminDeviceResponse {
    pub id: String,
    pub name: String,
    pub version: String,
    pub online: bool,
    pub busy: bool,
    pub last_seen: i64,
    pub user_id: String,
    pub registered_at: i64,
}

async fn list_all_devices(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
) -> Result<Json<Vec<AdminDeviceResponse>>, AppError> {
    require_admin(&user)?;

    let state = state.read().await;
    let store_devices = state.store.list_devices(None).await;
    let online_ids: HashSet<String> = state.client_hub.list_online().await
        .into_iter().map(|e| e.id).collect();

    let result: Vec<AdminDeviceResponse> = store_devices
        .into_iter()
        .map(|d| {
            let online = online_ids.contains(&d.id);
            AdminDeviceResponse {
                id: d.id,
                name: d.name,
                version: d.version,
                online,
                busy: d.busy,
                last_seen: d.last_seen,
                user_id: d.user_id,
                registered_at: d.registered_at,
            }
        })
        .collect();

    Ok(Json(result))
}

async fn admin_delete_device(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    require_admin(&user)?;

    let state = state.read().await;

    // If device is online, kick and unregister it
    state.client_hub.kick_and_unregister(&id).await;

    state
        .store
        .delete_device(&id)
        .await
        .map_err(|e| AppError::NotFound(e))?;

    Ok(Json(serde_json::json!({ "message": "device deleted" })))
}

// ── Session Management ──

#[derive(Serialize)]
pub struct AdminSessionResponse {
    pub id: String,
    pub device_id: String,
    pub user_id: String,
    pub created_at: i64,
    pub closed: bool,
    pub cwd: Option<String>,
    pub active: bool,
}

#[derive(Serialize)]
pub struct SessionDetailResponse {
    pub id: String,
    pub device_id: String,
    pub user_id: String,
    pub created_at: i64,
    pub closed: bool,
    pub cwd: Option<String>,
    pub active: bool,
    pub history: Option<String>,
}

async fn list_all_sessions(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
) -> Result<Json<Vec<AdminSessionResponse>>, AppError> {
    require_admin(&user)?;

    let state = state.read().await;
    let sessions = state.store.list_all_sessions().await;

    let ids: Vec<String> = sessions.iter().map(|s| s.id.clone()).collect();
    let active_ids = state.web_hub.session_registry.filter_existing(&ids).await;

    let mut result = Vec::with_capacity(sessions.len());
    for s in sessions {
        let active = active_ids.contains(&s.id);
        result.push(AdminSessionResponse {
            id: s.id,
            device_id: s.device_id,
            user_id: s.user_id,
            created_at: s.created_at,
            closed: s.closed,
            cwd: s.cwd,
            active,
        });
    }

    Ok(Json(result))
}

async fn get_session_detail(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
    Path(id): Path<String>,
) -> Result<Json<SessionDetailResponse>, AppError> {
    require_admin(&user)?;

    let state = state.read().await;
    let session = state
        .store
        .get_session(&id)
        .await
        .ok_or(AppError::NotFound("session not found".into()))?;

    let active = state.web_hub.session_registry.get(&session.id).await.is_some();
    let history = if active {
        state.web_hub.session_registry.get_history(&session.id).await
    } else {
        None
    };

    Ok(Json(SessionDetailResponse {
        id: session.id,
        device_id: session.device_id,
        user_id: session.user_id,
        created_at: session.created_at,
        closed: session.closed,
        cwd: session.cwd,
        active,
        history,
    }))
}

#[derive(Serialize)]
pub struct TokenResponse {
    pub token: String,
}

/// Generate a one-time registration token for a desktop client.
async fn generate_token(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
) -> Result<Json<TokenResponse>, AppError> {
    require_admin(&user)?;

    let token = Uuid::new_v4().to_string();

    let state = state.read().await;
    state
        .store
        .create_client_token(&token, &user.user_id)
        .await
        .map_err(|e| AppError::Internal(e))?;

    Ok(Json(TokenResponse { token }))
}
