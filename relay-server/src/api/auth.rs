use axum::{http::HeaderMap, routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use std::net::{IpAddr, Ipv4Addr};
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
    headers: HeaderMap,
    Json(req): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, AppError> {
    if req.username.trim().is_empty() || req.password.trim().is_empty() {
        return Err(AppError::BadRequest("username and password required".into()));
    }

    if req.username.len() > 64 || req.password.len() > 256 {
        return Err(AppError::BadRequest("input too long".into()));
    }

    // Extract client IP from headers (trusted nginx proxy) or fall back to a safe default
    let client_ip = headers
        .get("X-Forwarded-For")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next().map(|s| s.trim()))
        .and_then(|s| s.parse::<IpAddr>().ok())
        .or_else(|| {
            headers
                .get("X-Real-IP")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<IpAddr>().ok())
        })
        .unwrap_or(IpAddr::V4(Ipv4Addr::new(0, 0, 0, 0)));

    let state = state.read().await;

    // Rate limit: check before processing credentials
    if !state.login_rate_limiter.check_and_record(client_ip) {
        return Err(AppError::TooManyRequests(
            "too many login attempts, try again later".into(),
        ));
    }

    let config = &state.config;

    // Check admin credentials from config first
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

        state.login_rate_limiter.clear(client_ip);

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

    state.login_rate_limiter.clear(client_ip);

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_login_request_deserialization() {
        let json = r#"{"username":"admin","password":"secret123"}"#;
        let req: LoginRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.username, "admin");
        assert_eq!(req.password, "secret123");
    }

    #[test]
    fn test_login_response_serialization() {
        let resp = LoginResponse {
            token: "test-token".into(),
            user_id: "test-user".into(),
            username: "testuser".into(),
            role: "Admin".into(),
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["token"], "test-token");
        assert_eq!(json["user_id"], "test-user");
        assert_eq!(json["username"], "testuser");
        assert_eq!(json["role"], "Admin");
    }

    #[test]
    fn test_logout_response_serialization() {
        let resp = LogoutResponse {
            message: "logged out".into(),
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["message"], "logged out");
    }

    #[test]
    fn test_verify_response_serialization() {
        let resp = VerifyResponse {
            valid: true,
            user_id: "uid".into(),
            username: "user".into(),
            role: "Admin".into(),
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["valid"], true);
        assert_eq!(json["user_id"], "uid");
        assert_eq!(json["username"], "user");
        assert_eq!(json["role"], "Admin");
    }
}
