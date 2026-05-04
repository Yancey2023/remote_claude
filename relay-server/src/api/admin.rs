use axum::{
    extract::Path,
    routing::{delete, get, patch, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
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
                role: format!("{:?}", u.role),
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
        role: format!("{:?}", new_user.role),
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
