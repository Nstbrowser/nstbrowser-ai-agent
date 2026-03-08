//! Browser provider connections for remote CDP sessions.
//!
//! Supports Browserbase, Browser Use, and Kernel providers. Each provider
//! returns a CDP WebSocket URL for connecting via BrowserManager.

use serde_json::json;
use std::env;

/// Provider session info for cleanup on failure.
pub struct ProviderSession {
    pub provider: String,
    pub session_id: String,
}

/// Connects to the specified browser provider and returns a CDP WebSocket URL
/// along with session info for cleanup on failure.
pub async fn connect_provider(
    provider_name: &str,
) -> Result<(String, Option<ProviderSession>), String> {
    match provider_name.to_lowercase().as_str() {
        _ => Err(format!(
            "Unknown provider '{}'. Only 'nst' and 'local' providers are supported",
            provider_name
        )),
    }
}

/// Close a provider session (call on CDP connect failure).
pub async fn close_provider_session(session: &ProviderSession) {
    let client = reqwest::Client::new();
    match session.provider.as_str() {
        "browserbase" => {
            if let Ok(api_key) = env::var("BROWSERBASE_API_KEY") {
                let _ = client
                    .delete(format!(
                        "https://api.browserbase.com/v1/sessions/{}",
                        session.session_id
                    ))
                    .header("X-BB-API-Key", &api_key)
                    .send()
                    .await;
            }
        }
        "browser-use" => {
            if let Ok(api_key) = env::var("BROWSER_USE_API_KEY") {
                let _ = client
                    .patch(format!(
                        "https://api.browser-use.com/api/v2/browsers/{}",
                        session.session_id
                    ))
                    .header("X-Browser-Use-API-Key", &api_key)
                    .header("Content-Type", "application/json")
                    .json(&json!({ "action": "stop" }))
                    .send()
                    .await;
            }
        }
        _ => {}
    }
}
