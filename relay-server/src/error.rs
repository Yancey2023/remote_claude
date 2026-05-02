use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
}

#[derive(Debug)]
pub enum AppError {
    Unauthorized(String),
    Forbidden(String),
    NotFound(String),
    BadRequest(String),
    Conflict(String),
    Internal(String),
}

impl AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            AppError::Forbidden(_) => StatusCode::FORBIDDEN,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Conflict(_) => StatusCode::CONFLICT,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn code_str(&self) -> &str {
        match self {
            AppError::Unauthorized(_) => "ERR_UNAUTHORIZED",
            AppError::Forbidden(_) => "ERR_FORBIDDEN",
            AppError::NotFound(_) => "ERR_NOT_FOUND",
            AppError::BadRequest(_) => "ERR_BAD_REQUEST",
            AppError::Conflict(_) => "ERR_CONFLICT",
            AppError::Internal(_) => "ERR_INTERNAL",
        }
    }

    fn message(&self) -> &str {
        match self {
            AppError::Unauthorized(m)
            | AppError::Forbidden(m)
            | AppError::NotFound(m)
            | AppError::BadRequest(m)
            | AppError::Conflict(m)
            | AppError::Internal(m) => m,
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let body = ApiError {
            code: self.code_str().to_string(),
            message: self.message().to_string(),
        };
        tracing::warn!("API error: {} {}", body.code, body.message);
        (status, Json(body)).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;

    #[test]
    fn test_unauthorized_status_code() {
        let err = AppError::Unauthorized("test".into());
        assert_eq!(err.status_code(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn test_forbidden_status_code() {
        let err = AppError::Forbidden("test".into());
        assert_eq!(err.status_code(), StatusCode::FORBIDDEN);
    }

    #[test]
    fn test_not_found_status_code() {
        let err = AppError::NotFound("test".into());
        assert_eq!(err.status_code(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn test_bad_request_status_code() {
        let err = AppError::BadRequest("test".into());
        assert_eq!(err.status_code(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn test_conflict_status_code() {
        let err = AppError::Conflict("test".into());
        assert_eq!(err.status_code(), StatusCode::CONFLICT);
    }

    #[test]
    fn test_internal_status_code() {
        let err = AppError::Internal("test".into());
        assert_eq!(err.status_code(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn test_code_str_values() {
        assert_eq!(AppError::Unauthorized("".into()).code_str(), "ERR_UNAUTHORIZED");
        assert_eq!(AppError::Forbidden("".into()).code_str(), "ERR_FORBIDDEN");
        assert_eq!(AppError::NotFound("".into()).code_str(), "ERR_NOT_FOUND");
        assert_eq!(AppError::BadRequest("".into()).code_str(), "ERR_BAD_REQUEST");
        assert_eq!(AppError::Conflict("".into()).code_str(), "ERR_CONFLICT");
        assert_eq!(AppError::Internal("".into()).code_str(), "ERR_INTERNAL");
    }

    #[test]
    fn test_message_returns_inner_string() {
        assert_eq!(AppError::Unauthorized("access denied".into()).message(), "access denied");
        assert_eq!(AppError::Forbidden("forbidden area".into()).message(), "forbidden area");
        assert_eq!(AppError::NotFound("missing".into()).message(), "missing");
        assert_eq!(AppError::BadRequest("bad input".into()).message(), "bad input");
        assert_eq!(AppError::Conflict("conflict".into()).message(), "conflict");
        assert_eq!(AppError::Internal("server error".into()).message(), "server error");
    }
}

