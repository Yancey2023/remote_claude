use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use crate::models::UserRole;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,   // user id
    pub username: String,
    pub role: String,  // "Admin" or "User"
    pub exp: usize,
    pub iat: usize,
}

pub fn create_token(
    user_id: &str,
    username: &str,
    role: &UserRole,
    secret: &str,
    expiry_hours: i64,
) -> Result<String, String> {
    let now = chrono::Utc::now().timestamp() as usize;
    let exp = now + (expiry_hours * 3600) as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        username: username.to_string(),
        role: format!("{:?}", role),
        exp,
        iat: now,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| format!("jwt encoding error: {}", e))
}

pub fn verify_token(token: &str, secret: &str) -> Result<Claims, String> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|e| format!("jwt verification error: {}", e))
}
