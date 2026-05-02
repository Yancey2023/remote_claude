use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub device_id: String,
    pub user_id: String,
    pub created_at: i64,
    pub closed: bool,
}

impl Session {
    pub fn new(id: String, device_id: String, user_id: String) -> Self {
        Self {
            id,
            device_id,
            user_id,
            created_at: chrono::Utc::now().timestamp(),
            closed: false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_new_sets_fields_correctly() {
        let session = Session::new(
            "session-1".into(),
            "device-1".into(),
            "user-1".into(),
        );
        assert_eq!(session.id, "session-1");
        assert_eq!(session.device_id, "device-1");
        assert_eq!(session.user_id, "user-1");
        assert!(!session.closed);
        let now = chrono::Utc::now().timestamp();
        assert!(session.created_at > 0);
        assert!(session.created_at <= now);
        assert!(session.created_at > now - 10);
    }
}
