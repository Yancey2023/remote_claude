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
    pub token_version: i64,
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
    token_version: i64,
) -> Result<String, String> {
    ensure_provider();
    let now = chrono::Utc::now().timestamp() as usize;
    let exp = now + (expiry_hours * 3600) as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        username: username.to_string(),
        role: role.as_str().to_string(),
        exp,
        iat: now,
        token_version,
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
        let token = create_token("user-1", "alice", &UserRole::User, secret, 24, 0).unwrap();
        let claims = verify_token(&token, secret).unwrap();
        assert_eq!(claims.sub, "user-1");
        assert_eq!(claims.username, "alice");
        assert_eq!(claims.role, "User");
        assert_eq!(claims.token_version, 0);
    }

    #[test]
    fn test_create_admin_token() {
        let secret = "admin-secret";
        let token = create_token("admin-id", "root", &UserRole::Admin, secret, 1, 1).unwrap();
        let claims = verify_token(&token, secret).unwrap();
        assert_eq!(claims.role, "Admin");
        assert_eq!(claims.token_version, 1);
    }

    #[test]
    fn test_verify_wrong_secret_fails() {
        let token = create_token("u1", "bob", &UserRole::User, "correct-secret", 24, 0).unwrap();
        let result = verify_token(&token, "wrong-secret");
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_invalid_token_fails() {
        let result = verify_token("invalid.jwt.token", "secret");
        assert!(result.is_err());
    }

    #[test]
    fn test_token_version_in_claims() {
        let secret = "version-test-secret";
        let token_v0 = create_token("u1", "alice", &UserRole::User, secret, 24, 0).unwrap();
        let claims_v0 = verify_token(&token_v0, secret).unwrap();
        assert_eq!(claims_v0.token_version, 0);

        let token_v5 = create_token("u2", "bob", &UserRole::User, secret, 24, 5).unwrap();
        let claims_v5 = verify_token(&token_v5, secret).unwrap();
        assert_eq!(claims_v5.token_version, 5);
    }

    #[test]
    fn test_token_version_mismatch_rejected_by_extractor() {
        // This test verifies the JWT itself is valid; the version mismatch
        // rejection is tested in auth/extractor.rs. Here we just confirm
        // that different versions produce different tokens.
        let secret = "mismatch-secret";
        let t1 = create_token("u1", "alice", &UserRole::User, secret, 24, 1).unwrap();
        let t2 = create_token("u1", "alice", &UserRole::User, secret, 24, 2).unwrap();
        assert_ne!(t1, t2);
        // Both tokens are valid JWTs with different version claims
        let c1 = verify_token(&t1, secret).unwrap();
        let c2 = verify_token(&t2, secret).unwrap();
        assert_eq!(c1.token_version, 1);
        assert_eq!(c2.token_version, 2);
    }
}
