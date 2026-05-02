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
