use serde::{Deserialize, Serialize};
use std::env;
use std::path::PathBuf;

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

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
struct ConfigFile {
    admin_user: Option<String>,
    admin_pass: Option<String>,
    jwt_secret: Option<String>,
    database_url: Option<String>,
    host: Option<String>,
    port: Option<u16>,
    jwt_expiry_hours: Option<i64>,
    heartbeat_interval_secs: Option<u64>,
    heartbeat_timeout_secs: Option<u64>,
}

impl Config {
    /// Load config with priority: config file > env var > hardcoded default.
    /// Missing fields are populated from env vars (or defaults) and saved to the config file.
    pub fn load() -> Self {
        let path = Self::config_path();
        let mut file_config = Self::load_file(&path);
        let mut modified = false;

        macro_rules! field_str {
            ($field:ident, $env:literal, $default:expr) => {{
                let val = file_config
                    .$field
                    .clone()
                    .or_else(|| env::var($env).ok())
                    .unwrap_or_else(|| $default.to_string());
                if file_config.$field.is_none() {
                    modified = true;
                    file_config.$field = Some(val.clone());
                }
                val
            }};
        }

        macro_rules! field_num {
            ($field:ident, $env:literal, $default:expr, $ty:ty) => {{
                let val: $ty = file_config
                    .$field
                    .or_else(|| env::var($env).ok().and_then(|v| v.parse().ok()))
                    .unwrap_or($default);
                if file_config.$field.is_none() {
                    modified = true;
                    file_config.$field = Some(val);
                }
                val
            }};
        }

        let config = Config {
            admin_user: field_str!(admin_user, "ADMIN_USER", "admin"),
            admin_pass: field_str!(admin_pass, "ADMIN_PASS", "admin123"),
            jwt_secret: field_str!(jwt_secret, "JWT_SECRET", ""),
            database_url: field_str!(database_url, "DATABASE_URL", "sqlite:data.db?mode=rwc"),
            host: field_str!(host, "HOST", "0.0.0.0"),
            port: field_num!(port, "PORT", 8080, u16),
            jwt_expiry_hours: field_num!(jwt_expiry_hours, "JWT_EXPIRY_HOURS", 24, i64),
            heartbeat_interval_secs: field_num!(
                heartbeat_interval_secs,
                "HEARTBEAT_INTERVAL_SECS",
                15,
                u64
            ),
            heartbeat_timeout_secs: field_num!(
                heartbeat_timeout_secs,
                "HEARTBEAT_TIMEOUT_SECS",
                30,
                u64
            ),
        };

        if modified {
            Self::save_file(&path, &file_config);
        }

        config
    }

    /// Resolve config file path:
    ///   - `CONFIG_PATH` env var override, or
    ///   - Platform-specific: Linux: `~/.config/remote-claude/relay-server.toml`
    ///     Windows: `%APPDATA%/remote-claude/relay-server.toml`
    fn config_path() -> PathBuf {
        if let Ok(path) = env::var("CONFIG_PATH") {
            return PathBuf::from(path);
        }
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."));
        exe_dir.join("config").join("relay-server.toml")
    }

    fn load_file(path: &PathBuf) -> ConfigFile {
        if path.exists() {
            std::fs::read_to_string(path)
                .ok()
                .and_then(|content| toml::from_str(&content).ok())
                .unwrap_or_default()
        } else {
            ConfigFile::default()
        }
    }

    fn save_file(path: &PathBuf, config: &ConfigFile) {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let content = toml::to_string_pretty(config).expect("failed to serialize config");
        let _ = std::fs::write(path, content);
    }

    /// Auto-generate a random jwt_secret if the current one is empty.
    /// Returns `true` if a new secret was generated and saved to the config file.
    pub fn ensure_jwt_secret(&mut self) -> bool {
        if !self.jwt_secret.is_empty() {
            return false;
        }
        let bytes: [u8; 32] = rand::random();
        self.jwt_secret = bytes.iter().map(|b| format!("{:02x}", b)).collect();

        let path = Self::config_path();
        let mut file_config = Self::load_file(&path);
        file_config.jwt_secret = Some(self.jwt_secret.clone());
        Self::save_file(&path, &file_config);

        true
    }
}

impl From<ConfigFile> for Config {
    fn from(f: ConfigFile) -> Self {
        Config {
            admin_user: f.admin_user.unwrap_or_else(|| "admin".into()),
            admin_pass: f.admin_pass.unwrap_or_else(|| "admin123".into()),
            jwt_secret: f.jwt_secret.unwrap_or_default(),
            database_url: f
                .database_url
                .unwrap_or_else(|| "sqlite:data.db?mode=rwc".into()),
            host: f.host.unwrap_or_else(|| "0.0.0.0".into()),
            port: f.port.unwrap_or(8080),
            jwt_expiry_hours: f.jwt_expiry_hours.unwrap_or(24),
            heartbeat_interval_secs: f.heartbeat_interval_secs.unwrap_or(15),
            heartbeat_timeout_secs: f.heartbeat_timeout_secs.unwrap_or(30),
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
    fn test_load_does_not_panic() {
        let config = Config::load();
        assert!(config.port > 0);
    }

    #[test]
    fn test_config_path_default() {
        let path = Config::config_path();
        assert!(path.ends_with("relay-server.toml"));
    }

    #[test]
    fn test_config_path_override() {
        // Set CONFIG_PATH and verify it's used
        unsafe { env::set_var("CONFIG_PATH", "/tmp/test-relay.toml") };
        let path = Config::config_path();
        assert_eq!(path, PathBuf::from("/tmp/test-relay.toml"));
        unsafe { env::remove_var("CONFIG_PATH") };
    }

    #[test]
    fn test_from_config_file() {
        let file_config = ConfigFile {
            admin_user: Some("admin".into()),
            admin_pass: Some("admin123".into()),
            jwt_secret: Some("jwt-secret".into()),
            database_url: Some("sqlite:data.db".into()),
            host: Some("127.0.0.1".into()),
            port: Some(9090),
            jwt_expiry_hours: Some(48),
            heartbeat_interval_secs: Some(10),
            heartbeat_timeout_secs: Some(20),
        };
        let config: Config = file_config.into();
        assert_eq!(config.admin_user, "admin");
        assert_eq!(config.port, 9090);
        assert_eq!(config.jwt_expiry_hours, 48);
        assert_eq!(config.heartbeat_interval_secs, 10);
        assert_eq!(config.heartbeat_timeout_secs, 20);
    }

    #[test]
    fn test_from_empty_config_file_uses_defaults() {
        let file_config = ConfigFile::default();
        let config: Config = file_config.into();
        assert_eq!(config.admin_user, "admin");
        assert_eq!(config.port, 8080);
        assert_eq!(config.jwt_expiry_hours, 24);
    }
}
