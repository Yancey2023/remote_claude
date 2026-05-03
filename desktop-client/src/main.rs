mod claude_runner;
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
                .unwrap_or_else(|_| "desktop_client=debug".into()),
        )
        .with_target(true)
        .init();

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
        "desktop-client starting"
    );

    let mut retry_delay = Duration::from_secs(1);

    loop {
        match ws_client::connect_and_run(&config).await {
            Ok(()) => {
                info!("connection closed normally, reconnecting...");
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
