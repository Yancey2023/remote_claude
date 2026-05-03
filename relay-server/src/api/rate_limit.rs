use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Sliding-window rate limiter keyed by IP address.
pub struct LoginRateLimiter {
    inner: Mutex<Inner>,
    max_attempts: usize,
    window: Duration,
}

struct Inner {
    /// IP → sorted list of recent attempt timestamps
    attempts: HashMap<IpAddr, Vec<Instant>>,
}

impl LoginRateLimiter {
    /// Create a new limiter allowing `max_attempts` per `window`.
    pub fn new(max_attempts: usize, window_secs: u64) -> Self {
        Self {
            inner: Mutex::new(Inner {
                attempts: HashMap::new(),
            }),
            max_attempts,
            window: Duration::from_secs(window_secs),
        }
    }

    /// Check if this IP is allowed to attempt a login.
    /// Returns `true` if under the limit, `false` if rate-limited.
    /// Records the attempt (only counts against the limit after calling this).
    pub fn check_and_record(&self, ip: IpAddr) -> bool {
        let mut inner = self.inner.lock().expect("rate limiter lock poisoned");
        let now = Instant::now();

        let attempts = inner.attempts.entry(ip).or_default();

        // Remove expired entries outside the window
        let cutoff = now - self.window;
        attempts.retain(|t| *t > cutoff);

        // Check limit
        if attempts.len() >= self.max_attempts {
            return false;
        }

        // Record this attempt
        attempts.push(now);
        true
    }

    /// Clear all recorded attempts for an IP (call on successful login).
    pub fn clear(&self, ip: IpAddr) {
        let mut inner = self.inner.lock().expect("rate limiter lock poisoned");
        inner.attempts.remove(&ip);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{IpAddr, Ipv4Addr};
    use std::thread;

    #[test]
    fn test_allows_within_limit() {
        let limiter = LoginRateLimiter::new(3, 60);
        let ip = IpAddr::V4(Ipv4Addr::new(192, 168, 1, 1));

        assert!(limiter.check_and_record(ip));
        assert!(limiter.check_and_record(ip));
        assert!(limiter.check_and_record(ip));
    }

    #[test]
    fn test_blocks_over_limit() {
        let limiter = LoginRateLimiter::new(3, 60);
        let ip = IpAddr::V4(Ipv4Addr::new(192, 168, 1, 2));

        assert!(limiter.check_and_record(ip));
        assert!(limiter.check_and_record(ip));
        assert!(limiter.check_and_record(ip));
        assert!(!limiter.check_and_record(ip)); // blocked
    }

    #[test]
    fn test_different_ips_independent() {
        let limiter = LoginRateLimiter::new(2, 60);
        let ip_a = IpAddr::V4(Ipv4Addr::new(10, 0, 0, 1));
        let ip_b = IpAddr::V4(Ipv4Addr::new(10, 0, 0, 2));

        assert!(limiter.check_and_record(ip_a));
        assert!(limiter.check_and_record(ip_a));
        assert!(!limiter.check_and_record(ip_a)); // blocked

        assert!(limiter.check_and_record(ip_b)); // still allowed
        assert!(limiter.check_and_record(ip_b));
        assert!(!limiter.check_and_record(ip_b));
    }

    #[test]
    fn test_clear_resets_counter() {
        let limiter = LoginRateLimiter::new(2, 60);
        let ip = IpAddr::V4(Ipv4Addr::new(10, 0, 0, 3));

        assert!(limiter.check_and_record(ip));
        assert!(limiter.check_and_record(ip));
        assert!(!limiter.check_and_record(ip));

        limiter.clear(ip);
        assert!(limiter.check_and_record(ip));
    }

    #[test]
    fn test_window_expires() {
        let limiter = LoginRateLimiter::new(2, 1); // 1-second window
        let ip = IpAddr::V4(Ipv4Addr::new(10, 0, 0, 4));

        assert!(limiter.check_and_record(ip));
        assert!(limiter.check_and_record(ip));
        assert!(!limiter.check_and_record(ip));

        // Wait for window to expire
        thread::sleep(Duration::from_millis(1100));

        assert!(limiter.check_and_record(ip));
    }
}
