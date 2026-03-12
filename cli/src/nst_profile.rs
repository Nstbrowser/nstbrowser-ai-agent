/// NST Profile resolution and browser management
/// This is a simplified MVP implementation for immediate testing
use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::{json, Value};
use std::env;

/// UUID v4 pattern for profile ID detection (case-insensitive)
/// Matches format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
static UUID_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
        .expect("Failed to compile UUID regex")
});

/// Check if a string matches UUID v4 pattern (case-insensitive)
///
/// # Arguments
/// * `value` - String to check
///
/// # Returns
/// * `true` if value matches UUID pattern, `false` otherwise
///
/// # Examples
/// ```
/// assert!(is_uuid("ef2b083a-8f77-4a7f-8441-a8d56bbd832b"));
/// assert!(is_uuid("EF2B083A-8F77-4A7F-8441-A8D56BBD832B"));
/// assert!(!is_uuid("proxy_ph"));
/// assert!(!is_uuid("my-test-profile"));
/// ```
pub fn is_uuid(value: &str) -> bool {
    UUID_REGEX.is_match(value)
}

// Note: This function is no longer used after simplification.
// Profile resolution is now handled directly in browser-profile-resolver.ts (Node.js)
// and will be handled in nst_profile_resolver.rs (Rust) when integrated.

/// Check if an action requires a browser
pub fn is_browser_action(action: &str) -> bool {
    !matches!(
        action,
        // NST management commands (don't need browser)
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
            // Auth commands (don't need browser)
            | "auth_save"
            | "auth_list"
            | "auth_show"
            | "auth_delete"
            // Orchestrator commands (don't need browser)
            | "confirm"
            | "deny"
            // Launch command (creates browser)
            | "launch"
    )
}

// Note: This function is no longer used after simplification.
// Commands now use a single "profile" field that auto-detects UUID format.

#[cfg(test)]
mod tests {
    use super::*;

    /// Property 1: UUID Detection Accuracy
    /// For any string input, if it matches the UUID v4 pattern (case-insensitive),
    /// the isUuid function should return true, and if it does not match, the function should return false.
    /// Validates: Requirements 1.1, 1.2, 1.4, 1.5
    #[test]
    fn test_uuid_detection_valid_lowercase() {
        let valid_uuids = vec![
            "ef2b083a-8f77-4a7f-8441-a8d56bbd832b",
            "123e4567-e89b-12d3-a456-426614174000",
            "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            "00000000-0000-0000-0000-000000000000",
            "ffffffff-ffff-ffff-ffff-ffffffffffff",
        ];

        for uuid in valid_uuids {
            assert!(
                is_uuid(uuid),
                "Should detect valid lowercase UUID: {}",
                uuid
            );
        }
    }

    #[test]
    fn test_uuid_detection_valid_uppercase() {
        let valid_uuids = vec![
            "EF2B083A-8F77-4A7F-8441-A8D56BBD832B",
            "123E4567-E89B-12D3-A456-426614174000",
            "A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11",
            "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF",
        ];

        for uuid in valid_uuids {
            assert!(
                is_uuid(uuid),
                "Should detect valid uppercase UUID: {}",
                uuid
            );
        }
    }

    #[test]
    fn test_uuid_detection_valid_mixed_case() {
        let valid_uuids = vec![
            "Ef2B083a-8F77-4a7f-8441-A8d56BBd832B",
            "123e4567-E89B-12d3-A456-426614174000",
            "A0EEbc99-9c0B-4EF8-bb6D-6BB9bd380A11",
        ];

        for uuid in valid_uuids {
            assert!(
                is_uuid(uuid),
                "Should detect valid mixed-case UUID: {}",
                uuid
            );
        }
    }

    #[test]
    fn test_uuid_detection_reject_profile_names() {
        let profile_names = vec![
            "proxy_ph",
            "my-test-profile",
            "test-profile-123",
            "production",
            "dev-environment",
            "user_profile_1",
        ];

        for name in profile_names {
            assert!(!is_uuid(name), "Should reject profile name: {}", name);
        }
    }

    #[test]
    fn test_uuid_detection_reject_no_hyphens() {
        let invalid_uuids = vec![
            "ef2b083a8f774a7f8441a8d56bbd832b",
            "123e4567e89b12d3a456426614174000",
        ];

        for uuid in invalid_uuids {
            assert!(
                !is_uuid(uuid),
                "Should reject UUID without hyphens: {}",
                uuid
            );
        }
    }

    #[test]
    fn test_uuid_detection_reject_incomplete() {
        let invalid_uuids = vec![
            "ef2b083a-8f77-4a7f-8441",
            "ef2b083a-8f77-4a7f",
            "ef2b083a-8f77",
            "ef2b083a",
        ];

        for uuid in invalid_uuids {
            assert!(!is_uuid(uuid), "Should reject incomplete UUID: {}", uuid);
        }
    }

    #[test]
    fn test_uuid_detection_reject_wrong_hyphen_positions() {
        let invalid_uuids = vec![
            "ef2b083a8-f77-4a7f-8441-a8d56bbd832b",
            "ef2b083a-8f774-a7f-8441-a8d56bbd832b",
            "ef2b083a-8f77-4a7f8-441-a8d56bbd832b",
        ];

        for uuid in invalid_uuids {
            assert!(
                !is_uuid(uuid),
                "Should reject UUID with wrong hyphen positions: {}",
                uuid
            );
        }
    }

    #[test]
    fn test_uuid_detection_reject_non_hex() {
        let invalid_uuids = vec![
            "gf2b083a-8f77-4a7f-8441-a8d56bbd832b",
            "ef2b083a-8f77-4a7f-8441-a8d56bbd832z",
            "ef2b083a-8f77-4a7f-8441-a8d56bbd832!",
        ];

        for uuid in invalid_uuids {
            assert!(
                !is_uuid(uuid),
                "Should reject UUID with non-hex characters: {}",
                uuid
            );
        }
    }

    #[test]
    fn test_uuid_detection_reject_empty_and_special() {
        let invalid_inputs = vec![
            "",
            " ",
            "null",
            "undefined",
            "   ef2b083a-8f77-4a7f-8441-a8d56bbd832b   ", // with spaces
        ];

        for input in invalid_inputs {
            assert!(!is_uuid(input), "Should reject special case: '{}'", input);
        }
    }

    #[test]
    fn test_uuid_detection_reject_extra_characters() {
        let invalid_uuids = vec![
            "xef2b083a-8f77-4a7f-8441-a8d56bbd832b",
            "ef2b083a-8f77-4a7f-8441-a8d56bbd832bx",
            "{ef2b083a-8f77-4a7f-8441-a8d56bbd832b}",
        ];

        for uuid in invalid_uuids {
            assert!(
                !is_uuid(uuid),
                "Should reject UUID with extra characters: {}",
                uuid
            );
        }
    }

    #[test]
    fn test_uuid_detection_random_valid_uuids() {
        use uuid::Uuid;

        // Test 100 randomly generated valid UUIDs
        for _ in 0..100 {
            let uuid = Uuid::new_v4().to_string();
            assert!(
                is_uuid(&uuid),
                "Should detect randomly generated UUID: {}",
                uuid
            );
        }
    }

    #[test]
    fn test_uuid_detection_random_non_uuid_strings() {
        use rand::Rng;

        let mut rng = rand::thread_rng();
        let chars: Vec<char> = "abcdefghijklmnopqrstuvwxyz0123456789_-".chars().collect();

        // Test 100 randomly generated non-UUID strings
        for _ in 0..100 {
            let length = rng.gen_range(5..30);
            let random_string: String = (0..length)
                .map(|_| chars[rng.gen_range(0..chars.len())])
                .collect();

            // Only test if it's clearly not a UUID format
            if random_string.len() != 36 || !random_string.contains('-') {
                assert!(
                    !is_uuid(&random_string),
                    "Should reject non-UUID string: {}",
                    random_string
                );
            }
        }
    }

    #[test]
    fn test_uuid_detection_case_variations() {
        let base_uuid = "ef2b083a-8f77-4a7f-8441-a8d56bbd832b";

        // Test 50 random case variations
        for _ in 0..50 {
            let varied_uuid: String = base_uuid
                .chars()
                .map(|c| {
                    if c.is_ascii_hexdigit() && c.is_ascii_lowercase() {
                        if rand::random::<bool>() {
                            c.to_ascii_uppercase()
                        } else {
                            c
                        }
                    } else {
                        c
                    }
                })
                .collect();

            assert!(
                is_uuid(&varied_uuid),
                "Should detect UUID with case variation: {}",
                varied_uuid
            );
        }
    }
}
