use serde::{Deserialize, Serialize};
use std::env;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct Config {
    pub server_url: String,
    pub client_token: String,
    pub device_name: String,
    pub client_version: String,
    pub max_retry_delay_secs: u64,
    pub device_id: String,
    pub claude_binary: String,
}

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
struct ConfigFile {
    server_url: Option<String>,
    client_token: Option<String>,
    device_name: Option<String>,
    client_version: Option<String>,
    max_retry_delay_secs: Option<u64>,
    device_id: Option<String>,
    claude_binary: Option<String>,
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

        // CLIENT_TOKEN is required — prompt user if missing from both file and env
        let client_token = file_config
            .client_token
            .clone()
            .or_else(|| env::var("CLIENT_TOKEN").ok())
            .unwrap_or_else(|| {
                eprintln!("CLIENT_TOKEN is not set in config file or environment variable.");
                eprint!("Please enter your client token: ");
                let mut input = String::new();
                std::io::stdin()
                    .read_line(&mut input)
                    .expect("failed to read token from stdin");
                let trimmed = input.trim().to_string();
                if trimmed.is_empty() {
                    eprintln!("Token cannot be empty. Exiting.");
                    std::process::exit(1);
                }
                trimmed
            });
        if file_config.client_token.is_none() {
            modified = true;
            file_config.client_token = Some(client_token.clone());
        }

        // DEVICE_ID: generate once on first launch, persist in config file
        let device_id = file_config
            .device_id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        if file_config.device_id.is_none() {
            modified = true;
            file_config.device_id = Some(device_id.clone());
        }

        let config = Config {
            server_url: field_str!(
                server_url,
                "SERVER_URL",
                "ws://127.0.0.1:8080/ws/client"
            ),
            client_token,
            device_name: field_str!(device_name, "DEVICE_NAME", hostname()),
            client_version: field_str!(client_version, "CLIENT_VERSION", "0.1.0"),
            max_retry_delay_secs: field_num!(max_retry_delay_secs, "MAX_RETRY_DELAY_SECS", 60, u64),
            device_id,
            claude_binary: field_str!(claude_binary, "CLAUDE_BINARY", "claude"),
        };

        if modified {
            Self::save_file(&path, &file_config);
        }

        config
    }

    fn config_path() -> PathBuf {
        if let Ok(path) = env::var("CONFIG_PATH") {
            return PathBuf::from(path);
        }
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."));
        exe_dir.join("config").join("desktop-client.toml")
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
}

/// Cross-platform hostname detection:
///   - `HOSTNAME` (Linux/macOS) or `COMPUTERNAME` (Windows) env var
///   - Fallback: `"unknown-device"`
fn hostname() -> String {
    env::var("HOSTNAME")
        .or_else(|_| env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "unknown-device".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_direct() {
        let config = Config {
            server_url: "ws://test:8080/ws/client".into(),
            client_token: "test-token".into(),
            device_name: "test-pc".into(),
            client_version: "1.0.0".into(),
            max_retry_delay_secs: 30,
            device_id: "dev-123".into(),
            claude_binary: "claude".into(),
        };
        assert_eq!(config.server_url, "ws://test:8080/ws/client");
        assert_eq!(config.client_token, "test-token");
        assert_eq!(config.device_name, "test-pc");
        assert_eq!(config.client_version, "1.0.0");
        assert_eq!(config.max_retry_delay_secs, 30);
        assert_eq!(config.device_id, "dev-123");
        assert_eq!(config.claude_binary, "claude");
    }

    #[test]
    fn test_config_default_version() {
        let config = Config {
            server_url: "ws://test:8080/ws/client".into(),
            client_token: "test-token".into(),
            device_name: "test-pc".into(),
            client_version: "0.1.0".into(),
            max_retry_delay_secs: 60,
            device_id: "dev-456".into(),
            claude_binary: "claude".into(),
        };
        assert_eq!(config.client_version, "0.1.0");
        assert_eq!(config.max_retry_delay_secs, 60);
        assert_eq!(config.device_id, "dev-456");
        assert_eq!(config.claude_binary, "claude");
    }

    #[test]
    fn test_config_path_default() {
        let path = Config::config_path();
        assert!(path.ends_with("desktop-client.toml"));
    }

    #[test]
    fn test_config_path_override() {
        unsafe { env::set_var("CONFIG_PATH", "/tmp/test-client.toml") };
        let path = Config::config_path();
        assert_eq!(path, PathBuf::from("/tmp/test-client.toml"));
        unsafe { env::remove_var("CONFIG_PATH") };
    }

    #[test]
    fn test_hostname_fallback() {
        // Should return either an env var or the fallback string
        let name = hostname();
        assert!(!name.is_empty());
    }
}
