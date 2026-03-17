/// NST Agent status checker
///
/// Provides functions to check if NST agent is running and responsive
/// using the /api/agent/agent/info endpoint

use std::time::Duration;

/// Check if NST agent is running by calling /api/agent/agent/info
pub async fn is_nst_agent_running(host: &str, port: u16, api_key: &str) -> bool {
    let url = format!("http://{}:{}/api/agent/agent/info", host, port);

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
    {
        Ok(c) => c,
        Err(_) => return false,
    };

    // Build CI header with version information
    let ci_header = format!(
        "nstbrowser-ai-agent/{}; native/{}",
        env!("CARGO_PKG_VERSION"),
        env!("CARGO_PKG_VERSION")
    );

    let response = client
        .get(&url)
        .header("x-api-key", api_key)
        .header("Content-Type", "application/json")
        .header("ci", ci_header)
        .send()
        .await;

    match response {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    }
}

/// Check if NST agent is running with config from environment or config file
pub async fn check_nst_agent_with_config() -> bool {
    use crate::config::ConfigManager;
    use std::env;

    // Try to load config
    let config = match ConfigManager::read() {
        Ok(c) => c,
        Err(_) => return false,
    };

    let api_key = config
        .api_key
        .or_else(|| env::var("NST_API_KEY").ok())
        .unwrap_or_default();

    if api_key.is_empty() {
        return false;
    }

    let host = config
        .host
        .or_else(|| env::var("NST_HOST").ok())
        .unwrap_or_else(|| "127.0.0.1".to_string());

    let port = config
        .port
        .or_else(|| env::var("NST_PORT").ok().and_then(|p| p.parse().ok()))
        .unwrap_or(8848);

    is_nst_agent_running(&host, port, &api_key).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_is_nst_agent_running_invalid_endpoint() {
        // Should return false for invalid endpoint
        let result = is_nst_agent_running("invalid.host", 9999, "test-key").await;
        assert!(!result);
    }
}
