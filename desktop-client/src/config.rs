use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub server_url: String,
    pub register_token: String,
    pub device_name: String,
    pub client_version: String,
    pub max_retry_delay_secs: u64,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            server_url: env::var("SERVER_URL")
                .unwrap_or_else(|_| "ws://127.0.0.1:8080/ws/client".to_string()),
            register_token: env::var("REGISTER_TOKEN")
                .expect("REGISTER_TOKEN environment variable must be set"),
            device_name: env::var("DEVICE_NAME")
                .unwrap_or_else(|_| {
                    hostname()
                }),
            client_version: env::var("CLIENT_VERSION")
                .unwrap_or_else(|_| "0.1.0".to_string()),
            max_retry_delay_secs: env::var("MAX_RETRY_DELAY_SECS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(60),
        }
    }
}

fn hostname() -> String {
    std::fs::read_to_string("/etc/hostname")
        .ok()
        .map(|s| s.trim().to_string())
        .or_else(|| {
            std::env::var("HOSTNAME").ok()
        })
        .unwrap_or_else(|| "unknown-device".to_string())
}
