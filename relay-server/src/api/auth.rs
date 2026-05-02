use axum::{routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::auth::extractor::AuthUser;
use crate::auth::jwt::create_token;
use crate::auth::password;
use crate::error::AppError;
use crate::models::UserRole;
use crate::ws::AppState;

pub fn router() -> Router<Arc<RwLock<AppState>>> {
    Router::new()
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/verify", post(verify))
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user_id: String,
    pub username: String,
    pub role: String,
}

async fn login(
    state: axum::extract::State<Arc<RwLock<AppState>>>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    if req.username.trim().is_empty() || req.password.trim().is_empty() {
        return Err(AppError::BadRequest("username and password required".into()));
    }

    if req.username.len() > 64 || req.password.len() > 256 {
        return Err(AppError::BadRequest("input too long".into()));
    }

    let state = state.read().await;
    let config = &state.config;

    // Check admin credentials from env vars first
    if req.username == config.admin_user {
        if req.password != config.admin_pass {
            return Err(AppError::Unauthorized("invalid credentials".into()));
        }
        let token = create_token(
            "admin",
            &req.username,
            &UserRole::Admin,
            &config.jwt_secret,
            config.jwt_expiry_hours,
        )
        .map_err(|e| AppError::Internal(e))?;

        return Ok(Json(LoginResponse {
            token,
            user_id: "admin".into(),
            username: req.username,
            role: "Admin".into(),
        }));
    }

    // Check regular users from store
    let user = state
        .store
        .get_user_by_username(&req.username)
        .await
        .ok_or(AppError::Unauthorized("invalid credentials".into()))?;

    if !user.enabled {
        return Err(AppError::Forbidden("account disabled".into()));
    }

    let valid = password::verify_password(&req.password, &user.password_hash)
        .map_err(|_| AppError::Internal("password verification error".into()))?;

    if !valid {
        return Err(AppError::Unauthorized("invalid credentials".into()));
    }

    let token = create_token(
        &user.id,
        &user.username,
        &user.role,
        &config.jwt_secret,
        config.jwt_expiry_hours,
    )
    .map_err(|e| AppError::Internal(e))?;

    Ok(Json(LoginResponse {
        token,
        user_id: user.id,
        username: user.username,
        role: format!("{:?}", user.role),
    }))
}

#[derive(Serialize)]
struct LogoutResponse {
    message: String,
}

async fn logout(
    _user: AuthUser,
) -> Json<LogoutResponse> {
    Json(LogoutResponse {
        message: "logged out".into(),
    })
}

#[derive(Serialize)]
struct VerifyResponse {
    valid: bool,
    user_id: String,
    username: String,
    role: String,
}

async fn verify(
    _state: axum::extract::State<Arc<RwLock<AppState>>>,
    user: AuthUser,
) -> Json<VerifyResponse> {
    Json(VerifyResponse {
        valid: true,
        user_id: user.user_id,
        username: user.username,
        role: user.role,
    })
}
