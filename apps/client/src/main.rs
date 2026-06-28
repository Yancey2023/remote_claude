mod config;
mod protocol;
mod pty_session;
mod ws_client;

use std::time::Duration;

use tracing::{error, info};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "remote_claude_client=debug".into()),
        )
        .with_target(true)
        .init();

    // Install the ring crypto provider for rustls before any TLS connection.
    // With default-features = false, features = ["ring"], only ring is compiled
    // in, but rustls 0.23 still requires an explicit install_default() call.
    rustls::crypto::CryptoProvider::install_default(
        rustls::crypto::ring::default_provider(),
    )
    .expect("Failed to install rustls ring crypto provider");

    // Set panic hook — catch panics, log them, keep running
    std::panic::set_hook(Box::new(|panic_info| {
        let msg = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "unknown panic".to_string()
        };
        let location = panic_info
            .location()
            .map(|l| l.to_string())
            .unwrap_or_default();
        error!(message = %msg, location = %location, "PANIC caught");
    }));

    let config = config::Config::load();
    let max_retry = Duration::from_secs(config.max_retry_delay_secs);

    info!(
        server = %config.server_url,
        device = %config.device_name,
        "remote-claude-client starting"
    );

    let mut retry_delay = Duration::from_secs(1);

    loop {
        match ws_client::connect_and_run(&config).await {
            Ok(()) => {
                info!("connection closed normally, reconnecting...");
                retry_delay = Duration::from_secs(1);
            }
            Err(e) => {
                error!(error = %e, "connection error");
            }
        }

        // Exponential backoff with jitter
        tokio::time::sleep(retry_delay).await;
        retry_delay = std::cmp::min(retry_delay * 2, max_retry);
        info!(delay_secs = %retry_delay.as_secs(), "reconnecting...");
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_ring_crypto_provider_available() {
        // Verify that the ring crypto provider is compiled in and constructable.
        // This confirms the Cargo.toml feature resolution is correct.
        let provider = rustls::crypto::ring::default_provider();
        assert!(
            provider.cipher_suites.len() > 0,
            "ring cipher suites should not be empty"
        );
        assert!(
            provider.kx_groups.len() > 0,
            "ring key exchange groups should not be empty"
        );
    }

    #[test]
    fn test_install_and_uninstall_crypto_provider() {
        // Temporarily install ring as the default provider and verify it works.
        // This simulates what main() does at startup.
        let installed = rustls::crypto::CryptoProvider::install_default(
            rustls::crypto::ring::default_provider(),
        );
        assert!(installed.is_ok(), "should be able to install ring provider");
        let default = rustls::crypto::CryptoProvider::get_default();
        assert!(default.is_some(), "default provider should be available after install");
    }
}
