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

    /// Verify backward compatibility with argon2 0.5 hashes.
    /// Uses the same test vectors from the upstream crate.
    const OLD_ARGON2_HASHES: &[(&str, &str)] = &[
        ("password", "$argon2i$v=19$m=65536,t=1,p=1$c29tZXNhbHQAAAAAAAAAAA$+r0d29hqEB0yasKr55ZgICsQGSkl0v0kgwhd+U3wyRo"),
        ("password", "$argon2id$v=19$m=262144,t=2,p=1$c29tZXNhbHQ$eP4eyR+zqlZX1y5xCFTkw9m5GYx0L5YWwvCFvtlbLow"),
        ("password", "$argon2id$v=19$m=65536,t=2,p=1$c29tZXNhbHQ$CTFhFdXPJO1aFaMaO6Mm5c8y7cJHAph8ArZWb2GRPPc"),
    ];

    #[test]
    fn test_backward_compat_with_argon2_v05() {
        for (password, hash) in OLD_ARGON2_HASHES {
            assert!(
                verify_password(password, hash).unwrap(),
                "should verify hash: {}",
                hash
            );
        }
    }

    #[test]
    fn test_backward_compat_wrong_password_rejected() {
        for (_, hash) in OLD_ARGON2_HASHES {
            assert!(
                !verify_password("wrong-password", hash).unwrap(),
                "should reject wrong password for hash: {}",
                hash
            );
        }
    }
}
