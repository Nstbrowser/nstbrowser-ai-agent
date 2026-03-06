
use serde_json::{json, Value};
use std::env;

pub fn resolve_nst_profile(
    nst_profile: Option<&str>,
    nst_profile_id: Option<&str>,
) -> Option<(Option<String>, Option<String>)> {
    if let Some(id) = nst_profile_id {
        return Some((Some(id.to_string()), None));
    }
    
    if let Some(name) = nst_profile {
        return Some((None, Some(name.to_string())));
    }
    
    if let Ok(id) = env::var("NST_PROFILE_ID") {
        if !id.trim().is_empty() {
            return Some((Some(id), None));
        }
    }
    
    if let Ok(name) = env::var("NST_PROFILE") {
        if !name.trim().is_empty() {
            return Some((None, Some(name)));
        }
    }
    
    None
}

pub fn is_browser_action(action: &str) -> bool {
    !matches!(
        action,
        "nst_browser_list"
            | "nst_browser_start"
            | "nst_browser_stop"
            | "nst_browser_stop_all"
            | "nst_profile_list"
            | "nst_profile_create"
            | "nst_profile_delete"
            | "nst_profile_proxy_update"
            | "nst_profile_proxy_reset"
            | "nst_profile_tags_list"
            | "nst_profile_tags_create"
            | "nst_profile_tags_clear"
            | "nst_profile_groups_list"
            | "nst_profile_group_change"
            | "nst_profile_cache_clear"
            | "nst_profile_cookies_clear"
            | "auth_save"
            | "auth_list"
            | "auth_show"
            | "auth_delete"
            | "confirm"
            | "deny"
            | "launch"
    )
}

pub fn enrich_command_with_profile(
    cmd: &mut Value,
    profile_id: Option<&str>,
    profile_name: Option<&str>,
) {
    if let Some(id) = profile_id {
        cmd["nstProfileId"] = json!(id);
    }
    if let Some(name) = profile_name {
        cmd["nstProfileName"] = json!(name);
    }
}
