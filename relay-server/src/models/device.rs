use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub version: String,
    pub online: bool,
    pub busy: bool,
    pub last_seen: i64,
    pub registered_at: i64,
}

impl Device {
    pub fn new(id: String, name: String, version: String) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            id,
            name,
            version,
            online: true,
            busy: false,
            last_seen: now,
            registered_at: now,
        }
    }
}

/// Internal device state that includes the communication channel.
/// This is not serialized over the wire — only used internally by ClientHub.
pub struct OnlineDevice {
    pub info: Device,
    pub tx: mpsc::Sender<String>,
}

impl OnlineDevice {
    pub fn new(id: String, name: String, version: String, tx: mpsc::Sender<String>) -> Self {
        Self {
            info: Device::new(id, name, version),
            tx,
        }
    }
}
