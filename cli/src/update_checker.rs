/// Auto-update checker for nstbrowser-ai-agent
///
/// Checks for new versions and notifies users about available updates.
/// Respects user preferences and caching to avoid excessive network requests.

use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const UPDATE_CHECK_INTERVAL: u64 = 24 * 60 * 60; // 24 hours in seconds
const NPM_PACKAGE: &str = "nstbrowser-ai-agent";
const GITHUB_REPO: &str = "Nstbrowser/nstbrowser-ai-agent";

#[derive(Debug, Serialize, Deserialize)]
struct UpdateCheckCache {
    last_check: u64,
    latest_version: String,
    current_version: String,
    #[serde(default)]
    dismissed: bool,
}

#[derive(Debug, Deserialize)]
struct NpmPackageInfo {
    version: String,
}

/// Get the cache directory for update checks
fn get_cache_dir() -> PathBuf {
    let home = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    let cache_dir = PathBuf::from(home).join(".nst-ai-agent").join("cache");
    fs::create_dir_all(&cache_dir).ok();
    cache_dir
}

/// Get the cache file path
fn get_cache_file() -> PathBuf {
    get_cache_dir().join("update-check.json")
}

/// Read update check cache
fn read_cache() -> Option<UpdateCheckCache> {
    let cache_file = get_cache_file();
    if !cache_file.exists() {
        return None;
    }
    let content = fs::read_to_string(cache_file).ok()?;
    serde_json::from_str(&content).ok()
}

/// Write update check cache
fn write_cache(cache: &UpdateCheckCache) {
    let cache_file = get_cache_file();
    if let Ok(content) = serde_json::to_string_pretty(cache) {
        fs::write(cache_file, content).ok();
    }
}

/// Get current package version
fn get_current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Fetch latest version from npm registry
async fn fetch_latest_version() -> Option<String> {
    let url = format!("https://registry.npmjs.org/{}/latest", NPM_PACKAGE);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .user_agent("nstbrowser-ai-agent-update-checker")
        .build()
        .ok()?;

    let response = client.get(&url).send().await.ok()?;

    if response.status().is_success() {
        let pkg_info: NpmPackageInfo = response.json().await.ok()?;
        Some(pkg_info.version)
    } else {
        None
    }
}

/// Compare version strings (semver-like)
fn is_newer_version(latest: &str, current: &str) -> bool {
    let latest_parts: Vec<u32> = latest
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    let current_parts: Vec<u32> = current
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();

    for i in 0..3 {
        let l = latest_parts.get(i).copied().unwrap_or(0);
        let c = current_parts.get(i).copied().unwrap_or(0);
        if l > c {
            return true;
        }
        if l < c {
            return false;
        }
    }

    false
}

/// Check for updates and notify user if available
///
/// This function:
/// - Checks cache to avoid excessive network requests
/// - Fetches latest version from npm registry
/// - Notifies user if update is available
/// - Respects user's dismiss preference
pub async fn check_for_updates(silent: bool) {
    // Check if update checks are disabled
    if env::var("NSTBROWSER_AI_AGENT_NO_UPDATE_CHECK").unwrap_or_default() == "1" {
        return;
    }

    let current_version = get_current_version();
    let cache = read_cache();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    // Check if we should skip (recently checked or dismissed)
    if let Some(ref c) = cache {
        if c.dismissed {
            // User dismissed this version, don't show again
            return;
        }

        if now - c.last_check < UPDATE_CHECK_INTERVAL {
            // Checked recently, skip
            return;
        }
    }

    // Fetch latest version
    let latest_version = match fetch_latest_version().await {
        Some(v) => v,
        None => {
            // Network error or timeout, update cache timestamp only
            if let Some(mut c) = cache {
                c.last_check = now;
                write_cache(&c);
            }
            return;
        }
    };

    // Update cache
    let new_cache = UpdateCheckCache {
        last_check: now,
        latest_version: latest_version.clone(),
        current_version: current_version.clone(),
        dismissed: false,
    };
    write_cache(&new_cache);

    // Check if update is available
    if is_newer_version(&latest_version, &current_version) && !silent {
        eprintln!();
        eprintln!("╭{}╮", "─".repeat(76));
        eprintln!(
            "│ Update available: {} → {}{}│",
            current_version,
            latest_version,
            " ".repeat(76 - 24 - current_version.len() - latest_version.len())
        );
        eprintln!("│{}│", " ".repeat(76));
        eprintln!(
            "│ Run: npm install -g nstbrowser-ai-agent@latest{}│",
            " ".repeat(76 - 49)
        );
        eprintln!(
            "│ Or:  npx nstbrowser-ai-agent@latest{}│",
            " ".repeat(76 - 39)
        );
        eprintln!("│{}│", " ".repeat(76));
        eprintln!(
            "│ Changelog: https://github.com/{}/releases{}│",
            GITHUB_REPO,
            " ".repeat(76 - 54 - GITHUB_REPO.len())
        );
        eprintln!("│{}│", " ".repeat(76));
        eprintln!(
            "│ To disable update checks: NSTBROWSER_AI_AGENT_NO_UPDATE_CHECK=1{}│",
            " ".repeat(76 - 66)
        );
        eprintln!("╰{}╯", "─".repeat(76));
        eprintln!();
    }
}

/// Force check for updates (ignores cache)
pub async fn force_check_for_updates() -> Result<UpdateCheckResult, String> {
    let current_version = get_current_version();
    let latest_version = fetch_latest_version()
        .await
        .ok_or_else(|| "Failed to fetch latest version from npm registry".to_string())?;

    let update_available = is_newer_version(&latest_version, &current_version);

    // Update cache
    let cache = UpdateCheckCache {
        last_check: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        latest_version: latest_version.clone(),
        current_version: current_version.clone(),
        dismissed: false,
    };
    write_cache(&cache);

    Ok(UpdateCheckResult {
        current: current_version,
        latest: latest_version,
        update_available,
    })
}

#[derive(Debug, Serialize)]
pub struct UpdateCheckResult {
    pub current: String,
    pub latest: String,
    pub update_available: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_newer_version() {
        assert!(is_newer_version("1.0.1", "1.0.0"));
        assert!(is_newer_version("1.1.0", "1.0.9"));
        assert!(is_newer_version("2.0.0", "1.9.9"));
        assert!(!is_newer_version("1.0.0", "1.0.0"));
        assert!(!is_newer_version("1.0.0", "1.0.1"));
        assert!(!is_newer_version("1.0.0", "2.0.0"));
    }
}
