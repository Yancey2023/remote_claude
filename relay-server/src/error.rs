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

