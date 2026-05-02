use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;
use tracing::{error, info};

/// Run a prompt through the local Claude CLI in `--print` mode.
/// Returns a receiver that yields lines of output, then closes when done.
pub async fn run_claude(
    prompt: &str,
    session_id: String,
    result_tx: mpsc::UnboundedSender<(String, String, bool)>,
) {
    info!(session_id = %session_id, prompt_len = %prompt.len(), "running claude command");

    let mut child = match Command::new("claude")
        .args(["--print", prompt])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(e) => {
            error!(error = %e, "failed to spawn claude process");
            let _ = result_tx.send((session_id, format!("Error: cannot start claude: {}", e), true));
            return;
        }
    };

    let stdout = child.stdout.take().expect("stdout not captured");
    let stderr = child.stderr.take().expect("stderr not captured");

    let tx_stdout = result_tx.clone();
    let sid_out = session_id.clone();

    // Read stdout line by line
    let stdout_handle = tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if tx_stdout.send((sid_out.clone(), line, false)).is_err() {
                break;
            }
        }
    });

    // Read stderr and send as error notes
    let tx_stderr = result_tx.clone();
    let sid_err = session_id.clone();
    let stderr_handle = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if tx_stderr
                .send((sid_err.clone(), format!("[stderr] {}", line), false))
                .is_err()
            {
                break;
            }
        }
    });

    // Wait for process and reader tasks
    let _ = tokio::join!(stdout_handle, stderr_handle);

    let status = child.wait().await;
    match status {
        Ok(exit) => {
            info!(session_id = %session_id, exit_code = %exit, "claude process finished");
        }
        Err(e) => {
            error!(session_id = %session_id, error = %e, "failed to wait for claude");
        }
    }

    let _ = result_tx.send((session_id, String::new(), true));
}
