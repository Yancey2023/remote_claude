use std::sync::Arc;

use axum::http::request::Parts;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use axum::extract::FromRequestParts;
use serde::Serialize;
use tokio::sync::RwLock;

use super::jwt::{verify_token, Claims};
use crate::ws::AppState;

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
    pub username: String,
    pub role: String,
}

#[derive(Debug, Serialize)]
struct AuthError {
    code: String,
    message: String,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        (StatusCode::UNAUTHORIZED, Json(self)).into_response()
    }
}

impl FromRequestParts<Arc<RwLock<AppState>>> for AuthUser {
    type Rejection = Response;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<RwLock<AppState>>,
    ) -> Result<Self, Self::Rejection> {
        let jwt_secret = {
            let state = state.read().await;
            state.config.jwt_secret.clone()
        };

        let token_str: String = {
            // Try Authorization: Bearer <token> first
            if let Some(token) = parts
                .headers
                .get("Authorization")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.strip_prefix("Bearer "))
            {
                token.to_string()
            }
            // Fall back to Cookie: token=<jwt>
            else if let Some(token) = parts
                .headers
                .get("Cookie")
                .and_then(|v| v.to_str().ok())
                .and_then(|cookie_str| {
                    cookie_str.split(';').find_map(|pair| {
                        let mut split = pair.splitn(2, '=');
                        let name = split.next()?.trim();
                        let value = split.next()?;
                        if name.eq_ignore_ascii_case("token") {
                            Some(value.to_string())
                        } else {
                            None
                        }
                    })
                }) {
                token
            } else {
                return Err(AuthError {
                    code: "ERR_MISSING_TOKEN".into(),
                    message: "missing authentication token".into(),
                }.into_response());
            }
        };

        let claims: Claims = verify_token(&token_str, &jwt_secret)
            .map_err(|e| AuthError {
                code: "ERR_INVALID_TOKEN".into(),
                message: format!("invalid token: {}", e),
            }.into_response())?;

        Ok(AuthUser {
            user_id: claims.sub,
            username: claims.username,
            role: claims.role,
        })
    }
}

impl AuthUser {
    pub fn is_admin(&self) -> bool {
        self.role == "Admin"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_admin_returns_true_when_role_is_admin() {
        let user = AuthUser {
            user_id: "1".into(),
            username: "admin".into(),
            role: "Admin".into(),
        };
        assert!(user.is_admin());
    }

    #[test]
    fn test_is_admin_returns_false_when_role_is_user() {
        let user = AuthUser {
            user_id: "2".into(),
            username: "user".into(),
            role: "User".into(),
        };
        assert!(!user.is_admin());
    }

    #[test]
    fn test_is_admin_returns_false_when_role_is_empty() {
        let user = AuthUser {
            user_id: "3".into(),
            username: "guest".into(),
            role: "".into(),
        };
        assert!(!user.is_admin());
    }
}
