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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_default_values() {
        let config = Config {
            admin_user: "admin".into(),
            admin_pass: "admin123".into(),
            jwt_secret: "dev-secret".into(),
            database_url: "sqlite:data.db".into(),
            host: "0.0.0.0".into(),
            port: 8080,
            jwt_expiry_hours: 24,
            heartbeat_interval_secs: 15,
            heartbeat_timeout_secs: 30,
        };
        assert_eq!(config.admin_user, "admin");
        assert_eq!(config.admin_pass, "admin123");
        assert_eq!(config.jwt_secret, "dev-secret");
        assert_eq!(config.database_url, "sqlite:data.db");
        assert_eq!(config.host, "0.0.0.0");
        assert_eq!(config.port, 8080);
        assert_eq!(config.jwt_expiry_hours, 24);
        assert_eq!(config.heartbeat_interval_secs, 15);
        assert_eq!(config.heartbeat_timeout_secs, 30);
    }

    #[test]
    fn test_from_env_does_not_panic() {
        let config = Config::from_env();
        assert!(config.port > 0);
    }
}
