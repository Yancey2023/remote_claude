use argon2::{password_hash::PasswordHasher, Argon2};

pub fn hash_password(password: &str) -> Result<String, String> {
    let hash = Argon2::default()
        .hash_password(password.as_bytes())
        .map_err(|e| format!("hashing error: {}", e))?;
    Ok(hash.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    use argon2::password_hash::{PasswordVerifier, Error};
    match Argon2::default().verify_password(password.as_bytes(), hash) {
        Ok(()) => Ok(true),
        Err(Error::PasswordInvalid) => Ok(false),
        Err(e) => Err(format!("verification error: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify() {
        let password = "secure-password-123";
        let hash = hash_password(password).unwrap();
        assert!(verify_password(password, &hash).unwrap());
    }

    #[test]
    fn test_wrong_password_fails() {
        let hash = hash_password("correct-password").unwrap();
        assert!(!verify_password("wrong-password", &hash).unwrap());
    }

    #[test]
    fn test_same_password_different_hashes() {
        let h1 = hash_password("mypassword").unwrap();
        let h2 = hash_password("mypassword").unwrap();
        assert_ne!(h1, h2); // each hash should have unique salt
        assert!(verify_password("mypassword", &h1).unwrap());
        assert!(verify_password("mypassword", &h2).unwrap());
    }

    #[test]
    fn test_invalid_hash_returns_error() {
        let result = verify_password("password", "not-a-valid-hash");
        assert!(result.is_err());
    }
}
