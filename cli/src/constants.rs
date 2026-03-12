//! Constants used throughout the application.
//!
//! This module centralizes all string literals and magic values to avoid duplication
//! and make maintenance easier.

// Environment variable names
pub const ENV_NST_API_KEY: &str = "NST_API_KEY";
pub const ENV_NST_HOST: &str = "NST_HOST";
pub const ENV_NST_PORT: &str = "NST_PORT";
pub const ENV_NSTBROWSER_AI_AGENT_DEBUG: &str = "NSTBROWSER_AI_AGENT_DEBUG";

// Configuration file names
pub const CONFIG_DIR: &str = ".nst-ai-agent";
pub const CONFIG_FILE: &str = "config.json";
pub const PROJECT_ENV_FILE: &str = ".nstbrowser-ai-agent.env";
pub const STANDARD_ENV_FILE: &str = ".env";

// Configuration keys
pub const CONFIG_KEY_API_KEY: &str = "key";
pub const CONFIG_KEY_HOST: &str = "host";
pub const CONFIG_KEY_PORT: &str = "port";

// Default values
pub const DEFAULT_NST_HOST: &str = "127.0.0.1";
pub const DEFAULT_NST_PORT: u16 = 8848;

// Validation constraints
pub const MIN_API_KEY_LENGTH: usize = 10;
pub const MAX_API_KEY_LENGTH: usize = 500;
pub const MIN_PORT: u16 = 1;
pub const MAX_PORT: u16 = 65535;

// Provider names
pub const PROVIDER_NST: &str = "nst";
pub const PROVIDER_LOCAL: &str = "local";

// Error messages
pub const ERR_API_KEY_NOT_SET: &str = "NST_API_KEY environment variable is not set";
pub const ERR_API_KEY_EMPTY: &str = "NST_API_KEY is set but empty";
pub const ERR_CONFIG_DIR: &str = "Could not determine home directory";

// Test-related constants
#[cfg(test)]
pub const TEST_BACKUP_SUFFIX: &str = ".test-backup";
