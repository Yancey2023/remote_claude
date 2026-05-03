use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistrationToken {
    pub token: String,
    pub created_at: i64,
    pub is_used: bool,
    pub used_by_device_id: Option<String>,
}

impl RegistrationToken {
    pub fn new(token: String) -> Self {
        Self {
            token,
            created_at: chrono::Utc::now().timestamp(),
            is_used: false,
            used_by_device_id: None,
        }
    }
}
