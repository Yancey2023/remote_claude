use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub version: String,
    pub online: bool,
    pub busy: bool,
    pub last_seen: i64,
    pub registered_at: i64,
    pub user_id: String,
}

impl Device {
    pub fn new(id: String, name: String, version: String, user_id: String) -> Self {
        let now = chrono::Utc::now().timestamp();
        Self {
            id,
            name,
            version,
            online: true,
            busy: false,
            last_seen: now,
            registered_at: now,
            user_id,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_device() {
        let d = Device::new("dev-1".into(), "my-pc".into(), "1.0.0".into(), "user-1".into());
        assert_eq!(d.id, "dev-1");
        assert_eq!(d.name, "my-pc");
        assert_eq!(d.version, "1.0.0");
        assert!(d.online);
        assert!(!d.busy);
        assert!(d.registered_at > 0);
        assert_eq!(d.user_id, "user-1");
    }

    #[test]
    fn test_device_offline() {
        let mut d = Device::new("dev-2".into(), "server".into(), "2.0.0".into(), "user-1".into());
        d.online = false;
        assert!(!d.online);
    }
}
