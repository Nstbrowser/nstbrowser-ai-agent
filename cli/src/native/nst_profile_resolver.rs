/// Unified NST browser profile resolution for all browser actions
///
/// This module implements the complete profile resolution logic that ensures
/// all browser action commands can seamlessly work with Nstbrowser profiles.
///
/// Resolution Rules:
/// 1. Check running browsers for matching name/ID (prefer earliest if multiple)
/// 2. If not running, start browser with profileId
/// 3. If name specified and profile doesn't exist → create new profile
/// 4. If ID specified and doesn't exist → error
/// 5. If no profile specified:
///    5.1: Check for running once browser, use earliest if found
///    5.2: If no running once browser, create new once browser
use serde_json::{json, Value};
use std::env;

use super::nst_client::{NstClient, RunningBrowser};

/// Check if a string is a valid UUID (case-insensitive)
pub fn is_uuid(input: &str) -> bool {
    let uuid_regex =
        regex::Regex::new(r"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
            .unwrap();
    uuid_regex.is_match(input)
}

#[derive(Debug, Clone)]
pub struct ProfileResolutionOptions {
    /// Explicit profile ID (highest priority)
    pub profile_id: Option<String>,
    /// Explicit profile name
    pub profile_name: Option<String>,
    /// NST API configuration
    pub nst_host: String,
    pub nst_port: u16,
    pub nst_api_key: String,
}

#[derive(Debug, Clone)]
pub struct ResolvedProfile {
    /// Resolved profile ID (None for once browser)
    pub profile_id: Option<String>,
    /// Profile name (if resolved from name)
    pub profile_name: Option<String>,
    /// Whether browser is already running
    pub is_running: bool,
    /// Whether this is a once/temporary browser
    pub is_once: bool,
    /// CDP WebSocket URL
    pub ws_url: String,
    /// Whether a new profile was created
    pub was_created: bool,
}

/// Resolve and ensure browser profile is ready for actions
///
/// Implements the complete resolution logic according to requirements
pub async fn resolve_browser_profile(
    options: ProfileResolutionOptions,
) -> Result<ResolvedProfile, String> {
    let debug = env::var("NSTBROWSER_AI_AGENT_DEBUG").unwrap_or_default() == "1";

    let client = NstClient::new(&options.nst_host, options.nst_port, &options.nst_api_key);

    // Determine profile from options or environment
    let mut profile_id = options.profile_id.clone();
    let mut profile_name = options.profile_name.clone();

    // CRITICAL: If profileName is provided and it's in UUID format, treat it as profileId instead
    // This satisfies requirement #5: all places that accept profile name must check if it's UUID format
    if let Some(ref name) = profile_name {
        if profile_id.is_none() && is_uuid(name) {
            if debug {
                eprintln!(
                    "[DEBUG] Profile name \"{}\" is UUID format, treating as profileId",
                    name
                );
            }
            profile_id = Some(name.clone());
            profile_name = None;
        }
    }

    // Check environment variables if not specified
    if profile_id.is_none() && profile_name.is_none() {
        if let Ok(id) = env::var("NST_PROFILE_ID") {
            if !id.trim().is_empty() {
                if debug {
                    eprintln!("[DEBUG] Using profile ID from NST_PROFILE_ID env: {}", id);
                }
                profile_id = Some(id);
            }
        }
    }

    if profile_id.is_none() && profile_name.is_none() {
        if let Ok(name) = env::var("NST_PROFILE") {
            if !name.trim().is_empty() {
                if debug {
                    eprintln!("[DEBUG] Using profile name from NST_PROFILE env: {}", name);
                }

                // Also check UUID format for environment variable
                if is_uuid(&name) {
                    if debug {
                        eprintln!(
                            "[DEBUG] NST_PROFILE env \"{}\" is UUID format, treating as profileId",
                            name
                        );
                    }
                    profile_id = Some(name);
                } else {
                    profile_name = Some(name);
                }
            }
        }
    }

    // === Rule 1: Check running browsers for matching name/ID ===
    let browsers = client.get_browsers().await?;
    let running_browsers: Vec<&RunningBrowser> = browsers.iter().filter(|b| b.running).collect();

    if debug {
        eprintln!("[DEBUG] Found {} running browsers", running_browsers.len());
    }

    // Check by profile ID first
    if let Some(ref pid) = profile_id {
        let running_by_id: Vec<&RunningBrowser> = running_browsers
            .iter()
            .filter(|b| b.profile_id.as_deref() == Some(pid.as_str()))
            .copied()
            .collect();

        if !running_by_id.is_empty() {
            // Use earliest started browser (first in list)
            let browser = running_by_id[0];
            if debug {
                eprintln!("[DEBUG] Found running browser with ID \"{}\"", pid);
            }

            let ws_url = format!(
                "ws://{}:{}/api/v2/connect/{}?x-api-key={}",
                options.nst_host, options.nst_port, pid, options.nst_api_key
            );

            return Ok(ResolvedProfile {
                profile_id: Some(pid.clone()),
                profile_name: browser.name.clone(),
                is_running: true,
                is_once: false,
                ws_url,
                was_created: false,
            });
        }
    }

    // Check by profile name
    if let Some(ref name) = profile_name {
        if profile_id.is_none() {
            let running_by_name: Vec<&RunningBrowser> = running_browsers
                .iter()
                .filter(|b| b.name.as_deref() == Some(name.as_str()))
                .copied()
                .collect();

            if !running_by_name.is_empty() {
                // Use earliest started browser (first in list)
                let browser = running_by_name[0];
                let pid = browser.profile_id.clone().unwrap_or_default();

                if debug {
                    let suffix = if running_by_name.len() > 1 {
                        format!(" ({} matches, using earliest)", running_by_name.len())
                    } else {
                        String::new()
                    };
                    eprintln!(
                        "[DEBUG] Found running browser with name \"{}\": {}{}",
                        name, pid, suffix
                    );
                }

                let ws_url = format!(
                    "ws://{}:{}/api/v2/connect/{}?x-api-key={}",
                    options.nst_host, options.nst_port, pid, options.nst_api_key
                );

                return Ok(ResolvedProfile {
                    profile_id: Some(pid),
                    profile_name: Some(name.clone()),
                    is_running: true,
                    is_once: false,
                    ws_url,
                    was_created: false,
                });
            }
        }
    }

    // === Rule 2: Start browser if not running (profile ID specified) ===
    if let Some(ref pid) = profile_id {
        if debug {
            eprintln!("[DEBUG] Profile ID specified but not running: {}", pid);
        }

        // Verify the profile exists
        let profiles = client.get_profiles(None).await?;
        let profile = profiles.iter().find(|p| p.profile_id == *pid);

        if profile.is_none() {
            // Rule 4: ID specified but doesn't exist → error
            return Err(format!(
                "Profile with ID \"{}\" not found. \
                 Run 'nstbrowser-ai-agent nst_profile_list' to see available profiles.",
                pid
            ));
        }

        let profile = profile.unwrap();

        // Start the browser
        if debug {
            eprintln!("[DEBUG] Starting browser for profile ID: {}", pid);
        }

        client.start_browser(pid).await?;

        let ws_url = format!(
            "ws://{}:{}/api/v2/connect/{}?x-api-key={}",
            options.nst_host, options.nst_port, pid, options.nst_api_key
        );

        return Ok(ResolvedProfile {
            profile_id: Some(pid.clone()),
            profile_name: Some(profile.name.clone()),
            is_running: true,
            is_once: false,
            ws_url,
            was_created: false,
        });
    }

    // === Rule 2 & 3: Resolve profile name → create if doesn't exist ===
    if let Some(ref name) = profile_name {
        if debug {
            eprintln!("[DEBUG] Resolving profile name: {}", name);
        }

        // Query profiles by name
        let profiles = client.get_profiles(Some(name)).await?;

        if profiles.is_empty() {
            // Rule 3: Name specified and doesn't exist → create new profile
            if debug {
                eprintln!(
                    "[DEBUG] Profile \"{}\" not found, creating new profile...",
                    name
                );
            }

            let new_profile = client.create_profile(name).await?;
            let pid = new_profile.profile_id.clone();

            if debug {
                eprintln!("[DEBUG] Created new profile \"{}\" with ID: {}", name, pid);
            }

            // Start the newly created profile
            client.start_browser(&pid).await?;

            let ws_url = format!(
                "ws://{}:{}/api/v2/connect/{}?x-api-key={}",
                options.nst_host, options.nst_port, pid, options.nst_api_key
            );

            return Ok(ResolvedProfile {
                profile_id: Some(pid),
                profile_name: Some(name.clone()),
                is_running: true,
                is_once: false,
                ws_url,
                was_created: true,
            });
        }

        // Use first matching profile
        let profile = &profiles[0];
        let pid = profile.profile_id.clone();

        if profiles.len() > 1 && debug {
            eprintln!(
                "[DEBUG] Found {} profiles with name \"{}\". Using the first one: {}",
                profiles.len(),
                name,
                pid
            );
        }

        // Start the browser
        if debug {
            eprintln!(
                "[DEBUG] Starting browser for profile \"{}\" (ID: {})",
                name, pid
            );
        }

        client.start_browser(&pid).await?;

        let ws_url = format!(
            "ws://{}:{}/api/v2/connect/{}?x-api-key={}",
            options.nst_host, options.nst_port, pid, options.nst_api_key
        );

        return Ok(ResolvedProfile {
            profile_id: Some(pid),
            profile_name: Some(name.clone()),
            is_running: true,
            is_once: false,
            ws_url,
            was_created: false,
        });
    }

    // === Rule 5: No profile specified → use once browser ===
    if debug {
        eprintln!("[DEBUG] No profile specified, checking for running once browsers...");
    }

    // Rule 5.1: Check if there's already a running once browser
    // Once browsers have profileId === "once" in the running browsers list
    let running_once_browsers: Vec<&RunningBrowser> = running_browsers
        .iter()
        .filter(|b| b.profile_id.as_deref() == Some("once"))
        .copied()
        .collect();

    if !running_once_browsers.is_empty() {
        // Use the earliest started once browser (first in list)
        if debug {
            eprintln!(
                "[DEBUG] Found {} running once browser(s), using earliest",
                running_once_browsers.len()
            );
        }

        let ws_url = format!(
            "ws://{}:{}/api/v2/connect?x-api-key={}",
            options.nst_host, options.nst_port, options.nst_api_key
        );

        return Ok(ResolvedProfile {
            profile_id: None,
            profile_name: None,
            is_running: true,
            is_once: true,
            ws_url,
            was_created: false,
        });
    }

    // Rule 5.2: No running once browser, create a new one
    if debug {
        eprintln!("[DEBUG] No running once browser found, will create new once browser");
    }

    // Build once browser WebSocket URL with config
    let config = json!({
        "platform": "Windows",
        "autoClose": true,
        "clearCacheOnClose": true,
    });
    let config_str = config.to_string();
    let config_param = urlencoding::encode(&config_str);
    let ws_url = format!(
        "ws://{}:{}/api/v2/connect?config={}&x-api-key={}",
        options.nst_host, options.nst_port, config_param, options.nst_api_key
    );

    Ok(ResolvedProfile {
        profile_id: None,
        profile_name: None,
        is_running: false, // Will be started when connecting
        is_once: true,
        ws_url,
        was_created: false,
    })
}

/// Extract profile resolution options from command and environment
pub fn extract_profile_options(
    cmd: &Value,
    nst_host: &str,
    nst_port: u16,
    nst_api_key: &str,
) -> ProfileResolutionOptions {
    ProfileResolutionOptions {
        profile_id: cmd
            .get("nstProfileId")
            .and_then(|v| v.as_str())
            .map(String::from),
        profile_name: cmd
            .get("nstProfileName")
            .and_then(|v| v.as_str())
            .map(String::from),
        nst_host: nst_host.to_string(),
        nst_port,
        nst_api_key: nst_api_key.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_uuid_valid() {
        assert!(is_uuid("ef2b083a-8f77-4a7f-8441-a8d56bbd832b"));
        assert!(is_uuid("EF2B083A-8F77-4A7F-8441-A8D56BBD832B"));
        assert!(is_uuid("123e4567-e89b-12d3-a456-426614174000"));
    }

    #[test]
    fn test_is_uuid_invalid() {
        assert!(!is_uuid("proxy_ph"));
        assert!(!is_uuid("my-test-profile"));
        assert!(!is_uuid("test-profile-123"));
        assert!(!is_uuid(""));
    }

    #[test]
    fn test_extract_profile_options() {
        let cmd = json!({
            "nstProfileId": "test-id",
            "nstProfileName": "test-name"
        });

        let options = extract_profile_options(&cmd, "localhost", 8848, "test-key");

        assert_eq!(options.profile_id, Some("test-id".to_string()));
        assert_eq!(options.profile_name, Some("test-name".to_string()));
        assert_eq!(options.nst_host, "localhost");
        assert_eq!(options.nst_port, 8848);
        assert_eq!(options.nst_api_key, "test-key");
    }
}
