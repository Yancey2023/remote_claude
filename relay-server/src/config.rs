use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub admin_user: String,
    pub admin_pass: String,
    pub jwt_secret: String,
    pub database_url: String,
    pub host: String,
    pub port: u16,
    pub jwt_expiry_hours: i64,
    pub heartbeat_interval_secs: u64,
    pub heartbeat_timeout_secs: u64,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            admin_user: env::var("ADMIN_USER").unwrap_or_else(|_| "admin".to_string()),
            admin_pass: env::var("ADMIN_PASS").unwrap_or_else(|_| "admin123".to_string()),
            jwt_secret: env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-in-prod".to_string()),
            database_url: env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:data.db?mode=rwc".to_string()),
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8080),
            jwt_expiry_hours: env::var("JWT_EXPIRY_HOURS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(24),
            heartbeat_interval_secs: env::var("HEARTBEAT_INTERVAL_SECS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(15),
            heartbeat_timeout_secs: env::var("HEARTBEAT_TIMEOUT_SECS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(30),
        }
    }
}
