use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use jsonwebtoken::crypto::rust_crypto::DEFAULT_PROVIDER;
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

fn ensure_provider() {
    static INIT: std::sync::OnceLock<()> = std::sync::OnceLock::new();
    INIT.get_or_init(|| {
        let _ = DEFAULT_PROVIDER.install_default();
    });
}

pub fn create_token(
    user_id: &str,
    username: &str,
    role: &UserRole,
    secret: &str,
    expiry_hours: i64,
) -> Result<String, String> {
    ensure_provider();
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
    ensure_provider();
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|e| format!("jwt verification error: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_verify_token() {
        let secret = "test-secret-key";
        let token = create_token("user-1", "alice", &UserRole::User, secret, 24).unwrap();
        let claims = verify_token(&token, secret).unwrap();
        assert_eq!(claims.sub, "user-1");
        assert_eq!(claims.username, "alice");
        assert_eq!(claims.role, "User");
    }

    #[test]
    fn test_create_admin_token() {
        let secret = "admin-secret";
        let token = create_token("admin-id", "root", &UserRole::Admin, secret, 1).unwrap();
        let claims = verify_token(&token, secret).unwrap();
        assert_eq!(claims.role, "Admin");
    }

    #[test]
    fn test_verify_wrong_secret_fails() {
        let token = create_token("u1", "bob", &UserRole::User, "correct-secret", 24).unwrap();
        let result = verify_token(&token, "wrong-secret");
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_invalid_token_fails() {
        let result = verify_token("invalid.jwt.token", "secret");
        assert!(result.is_err());
    }
}
