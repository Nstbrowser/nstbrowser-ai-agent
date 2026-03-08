use crate::constants::{
    CONFIG_DIR, CONFIG_FILE, CONFIG_KEY_API_KEY, CONFIG_KEY_HOST, CONFIG_KEY_PORT,
    DEFAULT_NST_HOST, DEFAULT_NST_PORT, ENV_NST_API_KEY, ENV_NST_HOST, ENV_NST_PORT,
    ERR_CONFIG_DIR, MAX_PORT, MIN_API_KEY_LENGTH, MIN_PORT,
};
use crate::flags::Config;
use serde_json;
use std::fs;
use std::path::{Path, PathBuf};

pub struct ConfigManager {
    config_path: PathBuf,
}

impl ConfigManager {
    pub fn new() -> Result<Self, String> {
        let home = dirs::home_dir().ok_or(ERR_CONFIG_DIR)?;
        let config_path = home.join(CONFIG_DIR).join(CONFIG_FILE);
        Ok(Self { config_path })
    }

    /// Read configuration from file, merge with environment variables, and apply defaults
    pub fn read() -> Result<NstConfig, String> {
        let manager = Self::new()?;
        let mut config = NstConfig::default();

        // Read from config file if it exists
        if manager.config_path.exists() {
            let content = fs::read_to_string(&manager.config_path)
                .map_err(|e| format!("Failed to read config file: {}", e))?;

            let file_config: Config = serde_json::from_str(&content)
                .map_err(|e| format!("Config file contains invalid JSON: {}", e))?;

            // Extract NST config from file
            config.api_key = file_config.nst_api_key;
            config.host = file_config.nst_host;
            config.port = file_config.nst_port;
        }

        // Environment variables override config file (for backward compatibility)
        // But config file takes priority if both are set (as per requirements)
        // Actually, re-reading requirements: Config file > Environment variable
        // So we should read env vars first, then override with config file

        // Read from environment variables
        let env_api_key = std::env::var(ENV_NST_API_KEY)
            .ok()
            .filter(|s| !s.trim().is_empty());
        let env_host = std::env::var(ENV_NST_HOST)
            .ok()
            .filter(|s| !s.trim().is_empty());
        let env_port = std::env::var(ENV_NST_PORT)
            .ok()
            .and_then(|s| s.parse::<u16>().ok());

        // Apply priority: config file > env var > defaults
        config.api_key = config.api_key.or(env_api_key);
        config.host = config
            .host
            .or(env_host)
            .or(Some(DEFAULT_NST_HOST.to_string()));
        config.port = config.port.or(env_port).or(Some(DEFAULT_NST_PORT));

        Ok(config)
    }

    /// Set a configuration value
    pub fn set(key: &str, value: &str) -> Result<(), String> {
        let manager = Self::new()?;

        // Validate key
        validate_config_key(key)?;

        // Validate value
        validate_config_value(key, value)?;

        // Ensure config directory exists
        manager.ensure_config_dir()?;

        // Read existing config or create new one
        let mut config = if manager.config_path.exists() {
            let content = fs::read_to_string(&manager.config_path)
                .map_err(|e| format!("Failed to read config file: {}", e))?;
            serde_json::from_str::<Config>(&content)
                .map_err(|e| format!("Config file contains invalid JSON: {}", e))?
        } else {
            Config::default()
        };

        // Update the appropriate field
        match key {
            CONFIG_KEY_API_KEY => config.nst_api_key = Some(value.to_string()),
            CONFIG_KEY_HOST => config.nst_host = Some(value.to_string()),
            CONFIG_KEY_PORT => config.nst_port = Some(value.parse::<u16>().unwrap()),
            _ => return Err(format!("Unknown config key: {}", key)),
        }

        // Write config atomically
        manager.write_config_atomic(&config)?;

        Ok(())
    }

    /// Get a specific configuration value
    pub fn get(key: &str) -> Result<String, String> {
        validate_config_key(key)?;

        let nst_config = Self::read()?;

        match key {
            CONFIG_KEY_API_KEY => nst_config
                .api_key
                .ok_or_else(|| "Not configured".to_string()),
            CONFIG_KEY_HOST => Ok(nst_config
                .host
                .unwrap_or_else(|| DEFAULT_NST_HOST.to_string())),
            CONFIG_KEY_PORT => Ok(nst_config.port.unwrap_or(DEFAULT_NST_PORT).to_string()),
            _ => Err(format!("Unknown config key: {}", key)),
        }
    }

    /// Remove a configuration value
    pub fn unset(key: &str) -> Result<(), String> {
        let manager = Self::new()?;

        validate_config_key(key)?;

        if !manager.config_path.exists() {
            return Ok(()); // Nothing to unset
        }

        // Read existing config
        let content = fs::read_to_string(&manager.config_path)
            .map_err(|e| format!("Failed to read config file: {}", e))?;
        let mut config = serde_json::from_str::<Config>(&content)
            .map_err(|e| format!("Config file contains invalid JSON: {}", e))?;

        // Remove the appropriate field
        match key {
            CONFIG_KEY_API_KEY => config.nst_api_key = None,
            CONFIG_KEY_HOST => config.nst_host = None,
            CONFIG_KEY_PORT => config.nst_port = None,
            _ => return Err(format!("Unknown config key: {}", key)),
        }

        // Write config atomically
        manager.write_config_atomic(&config)?;

        Ok(())
    }

    /// Display all configuration
    pub fn show() -> Result<String, String> {
        let manager = Self::new()?;
        let nst_config = Self::read()?;

        let mut output = String::new();
        output.push_str(&format!(
            "Config file: {}\n\n",
            manager.config_path.display()
        ));

        // Show API key (masked)
        if let Some(key) = &nst_config.api_key {
            output.push_str(&format!("API Key: {}\n", mask_api_key(key)));
        } else {
            output.push_str("API Key: Not configured\n");
        }

        // Show host
        output.push_str(&format!(
            "Host: {}\n",
            nst_config
                .host
                .unwrap_or_else(|| DEFAULT_NST_HOST.to_string())
        ));

        // Show port
        output.push_str(&format!(
            "Port: {}\n",
            nst_config.port.unwrap_or(DEFAULT_NST_PORT)
        ));

        Ok(output)
    }

    /// Ensure config directory exists with proper permissions
    fn ensure_config_dir(&self) -> Result<(), String> {
        let dir = self.config_path.parent().ok_or("Invalid config path")?;

        if !dir.exists() {
            fs::create_dir_all(dir)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;

            // Set directory permissions to 0700 (owner only)
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let perms = fs::Permissions::from_mode(0o700);
                fs::set_permissions(dir, perms)
                    .map_err(|e| format!("Failed to set directory permissions: {}", e))?;
            }
        }

        Ok(())
    }

    /// Set file permissions to 0600 (owner read/write only)
    fn set_file_permissions(&self, path: &Path) -> Result<(), String> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let perms = fs::Permissions::from_mode(0o600);
            fs::set_permissions(path, perms)
                .map_err(|e| format!("Failed to set file permissions: {}", e))?;
        }
        Ok(())
    }

    /// Write config file atomically
    fn write_config_atomic(&self, config: &Config) -> Result<(), String> {
        let temp_path = self.config_path.with_extension("tmp");

        // Write to temp file
        let json = serde_json::to_string_pretty(config)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        fs::write(&temp_path, json).map_err(|e| format!("Failed to write config file: {}", e))?;

        // Set permissions
        self.set_file_permissions(&temp_path)?;

        // Atomic rename
        fs::rename(&temp_path, &self.config_path)
            .map_err(|e| format!("Failed to save config file: {}", e))?;

        Ok(())
    }
}

/// NST configuration structure
#[derive(Debug, Default)]
pub struct NstConfig {
    pub api_key: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
}

/// Mask API key to show only first 8 characters
fn mask_api_key(key: &str) -> String {
    if key.len() <= 8 {
        format!("{}...", key)
    } else {
        format!("{}...", &key[..8])
    }
}

/// Validate configuration key
fn validate_config_key(key: &str) -> Result<(), String> {
    match key {
        CONFIG_KEY_API_KEY | CONFIG_KEY_HOST | CONFIG_KEY_PORT => Ok(()),
        _ => Err(format!(
            "Unknown config key: {}. Valid keys: {}, {}, {}",
            key, CONFIG_KEY_API_KEY, CONFIG_KEY_HOST, CONFIG_KEY_PORT
        )),
    }
}

/// Validate configuration value
fn validate_config_value(key: &str, value: &str) -> Result<(), String> {
    match key {
        CONFIG_KEY_API_KEY => {
            if value.len() < MIN_API_KEY_LENGTH {
                return Err(format!(
                    "API key too short (minimum {} characters)",
                    MIN_API_KEY_LENGTH
                ));
            }
            Ok(())
        }
        CONFIG_KEY_HOST => {
            if value.is_empty() {
                return Err("Host cannot be empty".to_string());
            }
            Ok(())
        }
        CONFIG_KEY_PORT => {
            let port: u16 = value.parse().map_err(|_| {
                format!(
                    "Port must be a number between {} and {}",
                    MIN_PORT, MAX_PORT
                )
            })?;
            if port == 0 {
                return Err(format!(
                    "Port must be between {} and {}",
                    MIN_PORT, MAX_PORT
                ));
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mask_api_key() {
        assert_eq!(mask_api_key("1234567890abcdef"), "12345678...");
        assert_eq!(mask_api_key("short"), "short...");
        assert_eq!(mask_api_key("12345678"), "12345678...");
    }

    #[test]
    fn test_validate_config_key() {
        assert!(validate_config_key("key").is_ok());
        assert!(validate_config_key("host").is_ok());
        assert!(validate_config_key("port").is_ok());
        assert!(validate_config_key("invalid").is_err());
    }

    #[test]
    fn test_validate_api_key() {
        assert!(validate_config_value("key", "1234567890").is_ok());
        assert!(validate_config_value("key", "short").is_err());
    }

    #[test]
    fn test_validate_host() {
        assert!(validate_config_value("host", "127.0.0.1").is_ok());
        assert!(validate_config_value("host", "api.example.com").is_ok());
        assert!(validate_config_value("host", "").is_err());
    }

    #[test]
    fn test_validate_port() {
        assert!(validate_config_value("port", "8080").is_ok());
        assert!(validate_config_value("port", "1").is_ok());
        assert!(validate_config_value("port", "65535").is_ok());
        assert!(validate_config_value("port", "0").is_err());
        assert!(validate_config_value("port", "abc").is_err());
        assert!(validate_config_value("port", "70000").is_err());
    }
}
