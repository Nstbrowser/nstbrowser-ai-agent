use crate::color;
use crate::constants::{
    CONFIG_DIR, ENV_NSTBROWSER_AI_AGENT_DEBUG, ENV_NST_API_KEY, ENV_NST_HOST, ENV_NST_PORT,
    ERR_API_KEY_EMPTY, ERR_API_KEY_NOT_SET, MAX_API_KEY_LENGTH, MAX_PORT, MIN_API_KEY_LENGTH,
    MIN_PORT, PROJECT_ENV_FILE, PROVIDER_LOCAL, PROVIDER_NST, STANDARD_ENV_FILE,
};
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const CONFIG_FILENAME: &str = "config.json";
const PROJECT_CONFIG_FILENAME: &str = "nstbrowser-ai-agent.json";

/// Load environment variables from .env files
/// Tries to load in this order:
/// 1. .nstbrowser-ai-agent.env (project-specific)
/// 2. .env (standard)
pub fn load_env_files() {
    // Try project-specific env file first
    if let Ok(_) = dotenvy::from_filename(PROJECT_ENV_FILE) {
        if env::var(ENV_NSTBROWSER_AI_AGENT_DEBUG).unwrap_or_default() == "1" {
            eprintln!("[DEBUG] Loaded environment from {}", PROJECT_ENV_FILE);
        }
        return;
    }

    // Fall back to standard .env file
    if let Ok(_) = dotenvy::dotenv() {
        if env::var(ENV_NSTBROWSER_AI_AGENT_DEBUG).unwrap_or_default() == "1" {
            eprintln!("[DEBUG] Loaded environment from {}", STANDARD_ENV_FILE);
        }
        return;
    }

    // No .env file found - this is OK, not an error
    if env::var(ENV_NSTBROWSER_AI_AGENT_DEBUG).unwrap_or_default() == "1" {
        eprintln!("[DEBUG] No .env file found (this is OK)");
    }
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Config {
    pub headed: Option<bool>,
    pub json: Option<bool>,
    pub full: Option<bool>,
    pub debug: Option<bool>,
    pub session: Option<String>,
    pub session_name: Option<String>,
    pub executable_path: Option<String>,
    pub extensions: Option<Vec<String>>,
    pub profile: Option<String>,
    pub state: Option<String>,
    pub proxy: Option<String>,
    pub proxy_bypass: Option<String>,
    pub args: Option<String>,
    pub user_agent: Option<String>,
    pub provider: Option<String>,
    pub ignore_https_errors: Option<bool>,
    pub allow_file_access: Option<bool>,
    pub cdp: Option<String>,
    pub auto_connect: Option<bool>,
    pub headers: Option<String>,
    pub annotate: Option<bool>,
    pub color_scheme: Option<String>,
    pub download_path: Option<String>,
    pub content_boundaries: Option<bool>,
    pub max_output: Option<usize>,
    pub allowed_domains: Option<Vec<String>>,
    pub action_policy: Option<String>,
    pub confirm_actions: Option<String>,
    pub confirm_interactive: Option<bool>,
    pub native: Option<bool>,
    pub local: Option<bool>,
    // NST configuration
    pub nst_api_key: Option<String>,
    pub nst_host: Option<String>,
    pub nst_port: Option<u16>,
}

impl Config {
    fn merge(self, other: Config) -> Config {
        Config {
            headed: other.headed.or(self.headed),
            json: other.json.or(self.json),
            full: other.full.or(self.full),
            debug: other.debug.or(self.debug),
            session: other.session.or(self.session),
            session_name: other.session_name.or(self.session_name),
            executable_path: other.executable_path.or(self.executable_path),
            extensions: match (self.extensions, other.extensions) {
                (Some(mut a), Some(b)) => {
                    a.extend(b);
                    Some(a)
                }
                (a, b) => b.or(a),
            },
            profile: other.profile.or(self.profile),
            state: other.state.or(self.state),
            proxy: other.proxy.or(self.proxy),
            proxy_bypass: other.proxy_bypass.or(self.proxy_bypass),
            args: other.args.or(self.args),
            user_agent: other.user_agent.or(self.user_agent),
            provider: other.provider.or(self.provider),
            ignore_https_errors: other.ignore_https_errors.or(self.ignore_https_errors),
            allow_file_access: other.allow_file_access.or(self.allow_file_access),
            cdp: other.cdp.or(self.cdp),
            auto_connect: other.auto_connect.or(self.auto_connect),
            headers: other.headers.or(self.headers),
            annotate: other.annotate.or(self.annotate),
            color_scheme: other.color_scheme.or(self.color_scheme),
            download_path: other.download_path.or(self.download_path),
            content_boundaries: other.content_boundaries.or(self.content_boundaries),
            max_output: other.max_output.or(self.max_output),
            allowed_domains: other.allowed_domains.or(self.allowed_domains),
            action_policy: other.action_policy.or(self.action_policy),
            confirm_actions: other.confirm_actions.or(self.confirm_actions),
            confirm_interactive: other.confirm_interactive.or(self.confirm_interactive),
            native: other.native.or(self.native),
            local: other.local.or(self.local),
            nst_api_key: other.nst_api_key.or(self.nst_api_key),
            nst_host: other.nst_host.or(self.nst_host),
            nst_port: other.nst_port.or(self.nst_port),
        }
    }
}

fn read_config_file(path: &Path) -> Option<Config> {
    let content = fs::read_to_string(path).ok()?;
    match serde_json::from_str::<Config>(&content) {
        Ok(config) => Some(config),
        Err(e) => {
            eprintln!(
                "{} invalid config file {}: {}",
                color::warning_indicator(),
                path.display(),
                e
            );
            None
        }
    }
}

/// Check if a boolean environment variable is set to a truthy value.
/// Returns false when unset, empty, or set to "0", "false", or "no" (case-insensitive).
fn env_var_is_truthy(name: &str) -> bool {
    match env::var(name) {
        Ok(val) => !matches!(val.to_lowercase().as_str(), "0" | "false" | "no" | ""),
        Err(_) => false,
    }
}

/// Parse an optional boolean value after a flag. Returns (value, consumed_next_arg).
/// Recognizes "true" as true, "false" as false. Bare flag defaults to true.
fn parse_bool_arg(args: &[String], i: usize) -> (bool, bool) {
    if let Some(v) = args.get(i + 1) {
        match v.as_str() {
            "true" => (true, true),
            "false" => (false, true),
            _ => (true, false),
        }
    } else {
        (true, false)
    }
}

/// Extract --config <path> from args before full flag parsing.
/// Returns `Some(Some(path))` if --config <path> found, `Some(None)` if --config
/// was the last arg with no value, `None` if --config not present.
///
/// Only flags that consume a following argument need to be listed here.
/// Boolean flags (--content-boundaries, --confirm-interactive, etc.) are
/// intentionally absent -- they don't take a value, so they can't cause
/// the next argument to be mis-consumed.
fn extract_config_path(args: &[String]) -> Option<Option<String>> {
    const FLAGS_WITH_VALUE: &[&str] = &[
        "--session",
        "--headers",
        "--executable-path",
        "--cdp",
        "--extension",
        "--profile",         // NST profile name
        "--profile-id",      // NST profile ID
        "--browser-profile", // Local browser profile path
        "--state",
        "--proxy",
        "--proxy-bypass",
        "--args",
        "--user-agent",
        "-p",
        "--provider",
        "--device",
        "--session-name",
        "--color-scheme",
        "--download-path",
        "--max-output",
        "--allowed-domains",
        "--action-policy",
        "--confirm-actions",
        "--nst-profile-name", // Deprecated
        "--nst-profile-id",   // Deprecated
    ];
    let mut i = 0;
    while i < args.len() {
        if args[i] == "--config" {
            return Some(args.get(i + 1).cloned());
        }
        if FLAGS_WITH_VALUE.contains(&args[i].as_str()) {
            i += 1;
        }
        i += 1;
    }
    None
}

pub fn load_config(args: &[String]) -> Result<Config, String> {
    let explicit = extract_config_path(args)
        .map(|p| ("--config", p))
        .or_else(|| {
            env::var("NSTBROWSER_AI_AGENT_CONFIG")
                .ok()
                .map(|p| ("NSTBROWSER_AI_AGENT_CONFIG", Some(p)))
        });

    if let Some((source, maybe_path)) = explicit {
        let path_str = maybe_path.ok_or_else(|| format!("{} requires a file path", source))?;
        let path = PathBuf::from(&path_str);
        if !path.exists() {
            return Err(format!("config file not found: {}", path_str));
        }
        return read_config_file(&path)
            .ok_or_else(|| format!("failed to load config from {}", path_str));
    }

    let user_config = dirs::home_dir()
        .map(|d| d.join(CONFIG_DIR).join(CONFIG_FILENAME))
        .and_then(|p| read_config_file(&p))
        .unwrap_or_default();

    let project_config = read_config_file(&PathBuf::from(PROJECT_CONFIG_FILENAME));

    Ok(match project_config {
        Some(project) => user_config.merge(project),
        None => user_config,
    })
}

pub struct Flags {
    pub json: bool,
    pub full: bool,
    pub headed: bool,
    pub debug: bool,
    pub session: String,
    pub headers: Option<String>,
    pub executable_path: Option<String>,
    pub cdp: Option<String>,
    pub extensions: Vec<String>,
    pub profile: Option<String>, // Local browser profile path (renamed from --profile to --browser-profile)
    pub state: Option<String>,
    pub proxy: Option<String>,
    pub proxy_bypass: Option<String>,
    pub args: Option<String>,
    pub user_agent: Option<String>,
    pub provider: Option<String>,
    pub ignore_https_errors: bool,
    pub allow_file_access: bool,
    pub auto_connect: bool,
    pub session_name: Option<String>,
    pub annotate: bool,
    pub color_scheme: Option<String>,
    pub download_path: Option<String>,
    pub content_boundaries: bool,
    pub max_output: Option<usize>,
    pub allowed_domains: Option<Vec<String>>,
    pub action_policy: Option<String>,
    pub confirm_actions: Option<String>,
    pub confirm_interactive: bool,
    pub native: bool,
    pub local: bool,
    pub nst_profile: Option<String>, // NST profile name (--profile)
    pub nst_profile_id: Option<String>, // NST profile ID (--profile-id)

    // Track which launch-time options were explicitly passed via CLI
    // (as opposed to being set only via environment variables)
    pub cli_executable_path: bool,
    pub cli_extensions: bool,
    pub cli_profile: bool,
    pub cli_state: bool,
    pub cli_args: bool,
    pub cli_user_agent: bool,
    pub cli_proxy: bool,
    pub cli_proxy_bypass: bool,
    pub cli_allow_file_access: bool,
    pub cli_annotate: bool,
    pub cli_download_path: bool,
    pub cli_provider: bool, // Track if --provider was set via CLI
}

pub fn parse_flags(args: &[String]) -> Flags {
    let config = load_config(args).unwrap_or_else(|e| {
        eprintln!("{} {}", color::warning_indicator(), e);
        std::process::exit(1);
    });

    let extensions_env = env::var("NSTBROWSER_AI_AGENT_EXTENSIONS")
        .ok()
        .map(|s| {
            s.split(',')
                .map(|p| p.trim().to_string())
                .filter(|p| !p.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let extensions = if !extensions_env.is_empty() {
        extensions_env
    } else {
        config.extensions.unwrap_or_default()
    };

    let mut flags = Flags {
        json: env_var_is_truthy("NSTBROWSER_AI_AGENT_JSON") || config.json.unwrap_or(false),
        full: env_var_is_truthy("NSTBROWSER_AI_AGENT_FULL") || config.full.unwrap_or(false),
        headed: env_var_is_truthy("NSTBROWSER_AI_AGENT_HEADED") || config.headed.unwrap_or(false),
        debug: env_var_is_truthy("NSTBROWSER_AI_AGENT_DEBUG") || config.debug.unwrap_or(false),
        session: env::var("NSTBROWSER_AI_AGENT_SESSION")
            .ok()
            .or(config.session)
            .unwrap_or_else(|| "default".to_string()),
        headers: config.headers,
        executable_path: env::var("NSTBROWSER_AI_AGENT_EXECUTABLE_PATH")
            .ok()
            .or(config.executable_path),
        cdp: config.cdp,
        extensions,
        profile: env::var("NSTBROWSER_AI_AGENT_PROFILE")
            .ok()
            .or(config.profile),
        state: env::var("NSTBROWSER_AI_AGENT_STATE").ok().or(config.state),
        proxy: env::var("NSTBROWSER_AI_AGENT_PROXY").ok().or(config.proxy),
        proxy_bypass: env::var("NSTBROWSER_AI_AGENT_PROXY_BYPASS")
            .ok()
            .or(config.proxy_bypass),
        args: env::var("NSTBROWSER_AI_AGENT_ARGS").ok().or(config.args),
        user_agent: env::var("NSTBROWSER_AI_AGENT_USER_AGENT")
            .ok()
            .or(config.user_agent),
        provider: env::var("NSTBROWSER_AI_AGENT_PROVIDER")
            .ok()
            .or(config.provider),
        ignore_https_errors: env_var_is_truthy("NSTBROWSER_AI_AGENT_IGNORE_HTTPS_ERRORS")
            || config.ignore_https_errors.unwrap_or(false),
        allow_file_access: env_var_is_truthy("NSTBROWSER_AI_AGENT_ALLOW_FILE_ACCESS")
            || config.allow_file_access.unwrap_or(false),
        auto_connect: env_var_is_truthy("NSTBROWSER_AI_AGENT_AUTO_CONNECT")
            || config.auto_connect.unwrap_or(false),
        session_name: env::var("NSTBROWSER_AI_AGENT_SESSION_NAME")
            .ok()
            .or(config.session_name),
        annotate: env_var_is_truthy("NSTBROWSER_AI_AGENT_ANNOTATE")
            || config.annotate.unwrap_or(false),
        color_scheme: env::var("NSTBROWSER_AI_AGENT_COLOR_SCHEME")
            .ok()
            .or(config.color_scheme),
        download_path: env::var("NSTBROWSER_AI_AGENT_DOWNLOAD_PATH")
            .ok()
            .or(config.download_path),
        content_boundaries: env_var_is_truthy("NSTBROWSER_AI_AGENT_CONTENT_BOUNDARIES")
            || config.content_boundaries.unwrap_or(false),
        max_output: env::var("NSTBROWSER_AI_AGENT_MAX_OUTPUT")
            .ok()
            .and_then(|s| s.parse().ok())
            .or(config.max_output),
        allowed_domains: env::var("NSTBROWSER_AI_AGENT_ALLOWED_DOMAINS")
            .ok()
            .map(|s| {
                s.split(',')
                    .map(|d| d.trim().to_lowercase())
                    .filter(|d| !d.is_empty())
                    .collect()
            })
            .or(config.allowed_domains),
        action_policy: env::var("NSTBROWSER_AI_AGENT_ACTION_POLICY")
            .ok()
            .or(config.action_policy),
        confirm_actions: env::var("NSTBROWSER_AI_AGENT_CONFIRM_ACTIONS")
            .ok()
            .or(config.confirm_actions),
        confirm_interactive: env_var_is_truthy("NSTBROWSER_AI_AGENT_CONFIRM_INTERACTIVE")
            || config.confirm_interactive.unwrap_or(false),
        native: env_var_is_truthy("NSTBROWSER_AI_AGENT_NATIVE") || config.native.unwrap_or(false),
        local: env_var_is_truthy("NSTBROWSER_AI_AGENT_LOCAL") || config.local.unwrap_or(false),
        nst_profile: env::var("NST_PROFILE").ok(),
        nst_profile_id: env::var("NST_PROFILE_ID").ok(),
        cli_executable_path: false,
        cli_extensions: false,
        cli_profile: false,
        cli_state: false,
        cli_args: false,
        cli_user_agent: false,
        cli_proxy: false,
        cli_proxy_bypass: false,
        cli_allow_file_access: false,
        cli_annotate: false,
        cli_download_path: false,
        cli_provider: false,
    };

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--json" => {
                let (val, consumed) = parse_bool_arg(args, i);
                flags.json = val;
                if consumed {
                    i += 1;
                }
            }
            "--full" | "-f" => {
                let (val, consumed) = parse_bool_arg(args, i);
                flags.full = val;
                if consumed {
                    i += 1;
                }
            }
            "--headed" => {
                let (val, consumed) = parse_bool_arg(args, i);
                flags.headed = val;
                if consumed {
                    i += 1;
                }
            }
            "--debug" => {
                let (val, consumed) = parse_bool_arg(args, i);
                flags.debug = val;
                if consumed {
                    i += 1;
                }
            }
            "--session" => {
                if let Some(s) = args.get(i + 1) {
                    flags.session = s.clone();
                    i += 1;
                }
            }
            "--headers" => {
                if let Some(h) = args.get(i + 1) {
                    flags.headers = Some(h.clone());
                    i += 1;
                }
            }
            "--executable-path" => {
                if let Some(s) = args.get(i + 1) {
                    flags.executable_path = Some(s.clone());
                    flags.cli_executable_path = true;
                    i += 1;
                }
            }
            "--extension" => {
                if let Some(s) = args.get(i + 1) {
                    flags.extensions.push(s.clone());
                    flags.cli_extensions = true;
                    i += 1;
                }
            }
            "--cdp" => {
                if let Some(s) = args.get(i + 1) {
                    flags.cdp = Some(s.clone());
                    i += 1;
                }
            }
            "--profile" => {
                // NST profile name (when using NST provider)
                if let Some(s) = args.get(i + 1) {
                    flags.nst_profile = Some(s.clone());
                    i += 1;
                }
            }
            "--profile-id" => {
                // NST profile ID (when using NST provider)
                if let Some(s) = args.get(i + 1) {
                    flags.nst_profile_id = Some(s.clone());
                    i += 1;
                }
            }
            "--browser-profile" => {
                // Local browser profile path (when using local provider)
                if let Some(s) = args.get(i + 1) {
                    flags.profile = Some(s.clone());
                    flags.cli_profile = true;
                    i += 1;
                }
            }
            "--state" => {
                if let Some(s) = args.get(i + 1) {
                    flags.state = Some(s.clone());
                    flags.cli_state = true;
                    i += 1;
                }
            }
            "--proxy" => {
                if let Some(p) = args.get(i + 1) {
                    flags.proxy = Some(p.clone());
                    flags.cli_proxy = true;
                    i += 1;
                }
            }
            "--proxy-bypass" => {
                if let Some(s) = args.get(i + 1) {
                    flags.proxy_bypass = Some(s.clone());
                    flags.cli_proxy_bypass = true;
                    i += 1;
                }
            }
            "--args" => {
                if let Some(s) = args.get(i + 1) {
                    flags.args = Some(s.clone());
                    flags.cli_args = true;
                    i += 1;
                }
            }
            "--user-agent" => {
                if let Some(s) = args.get(i + 1) {
                    flags.user_agent = Some(s.clone());
                    flags.cli_user_agent = true;
                    i += 1;
                }
            }
            "-p" | "--provider" => {
                if let Some(p) = args.get(i + 1) {
                    flags.provider = Some(p.clone());
                    flags.cli_provider = true;
                    i += 1;
                }
            }
            "--ignore-https-errors" => {
                let (val, consumed) = parse_bool_arg(args, i);
                flags.ignore_https_errors = val;
                if consumed {
                    i += 1;
                }
            }
            "--allow-file-access" => {
                let (val, consumed) = parse_bool_arg(args, i);
                flags.allow_file_access = val;
                flags.cli_allow_file_access = true;
                if consumed {
                    i += 1;
                }
            }
            "--auto-connect" => {
                let (val, consumed) = parse_bool_arg(args, i);
                flags.auto_connect = val;
                if consumed {
                    i += 1;
                }
            }
            "--session-name" => {
                if let Some(s) = args.get(i + 1) {
                    flags.session_name = Some(s.clone());
                    i += 1;
                }
            }
            "--annotate" => {
                let (val, consumed) = parse_bool_arg(args, i);
                flags.annotate = val;
                flags.cli_annotate = true;
                if consumed {
                    i += 1;
                }
            }
            "--color-scheme" => {
                if let Some(s) = args.get(i + 1) {
                    flags.color_scheme = Some(s.clone());
                    i += 1;
                }
            }
            "--download-path" => {
                if let Some(s) = args.get(i + 1) {
                    flags.download_path = Some(s.clone());
                    flags.cli_download_path = true;
                    i += 1;
                }
            }
            "--content-boundaries" => {
                let (val, consumed) = parse_bool_arg(args, i);
                flags.content_boundaries = val;
                if consumed {
                    i += 1;
                }
            }
            "--max-output" => {
                if let Some(s) = args.get(i + 1) {
                    if let Ok(n) = s.parse::<usize>() {
                        flags.max_output = Some(n);
                    }
                    i += 1;
                }
            }
            "--allowed-domains" => {
                if let Some(s) = args.get(i + 1) {
                    flags.allowed_domains = Some(
                        s.split(',')
                            .map(|d| d.trim().to_lowercase())
                            .filter(|d| !d.is_empty())
                            .collect(),
                    );
                    i += 1;
                }
            }
            "--nst-profile-name" => {
                // Deprecated: use --profile instead
                if let Some(s) = args.get(i + 1) {
                    eprintln!(
                        "{} --nst-profile-name is deprecated, use --profile instead",
                        color::warning_indicator()
                    );
                    flags.nst_profile = Some(s.clone());
                    i += 1;
                }
            }
            "--nst-profile-id" => {
                // Deprecated: use --profile-id instead
                if let Some(s) = args.get(i + 1) {
                    eprintln!(
                        "{} --nst-profile-id is deprecated, use --profile-id instead",
                        color::warning_indicator()
                    );
                    flags.nst_profile_id = Some(s.clone());
                    i += 1;
                }
            }
            "--action-policy" => {
                if let Some(s) = args.get(i + 1) {
                    flags.action_policy = Some(s.clone());
                    i += 1;
                }
            }
            "--confirm-actions" => {
                if let Some(s) = args.get(i + 1) {
                    flags.confirm_actions = Some(s.clone());
                    i += 1;
                }
            }
            "--confirm-interactive" => {
                let (val, consumed) = parse_bool_arg(args, i);
                flags.confirm_interactive = val;
                if consumed {
                    i += 1;
                }
            }
            "--native" => {
                let (val, consumed) = parse_bool_arg(args, i);
                flags.native = val;
                if consumed {
                    i += 1;
                }
            }
            "--local" => {
                let (val, consumed) = parse_bool_arg(args, i);
                flags.local = val;
                if consumed {
                    i += 1;
                }
            }
            "--config" => {
                // Already handled by load_config(); skip the value
                i += 1;
            }
            _ => {}
        }
        i += 1;
    }

    // Apply provider selection logic
    // Only pass provider to determine_provider if it was explicitly set via CLI
    let explicit_provider = if flags.cli_provider {
        flags.provider.as_deref()
    } else {
        None
    };
    let (provider, reason) = determine_provider(&flags, explicit_provider);
    flags.provider = Some(provider.clone());

    if flags.debug {
        eprintln!(
            "{} Provider selected: {} (reason: {})",
            color::info_indicator(),
            provider,
            reason
        );
    }

    flags
}

/// Determine the provider based on flags and environment variables.
/// Returns (provider, reason) tuple for debugging purposes.
/// Priority order:
/// 1. Explicit --provider flag (passed as explicit_provider parameter)
/// 2. --local flag (returns "local")
/// 3. --headed without --provider (returns "local")
/// 4. --cdp (returns "local")
/// 5. --auto-connect (returns "local")
/// 6. NST_API_KEY environment variable present (returns "nst")
/// 7. Default (returns "nst")
fn determine_provider(flags: &Flags, explicit_provider: Option<&str>) -> (String, &'static str) {
    // Priority 1: Explicit --provider flag (from command line, not env/config)
    if let Some(provider) = explicit_provider {
        return (provider.to_string(), "explicit --provider flag");
    }

    // Priority 2: --local flag
    if flags.local {
        return (PROVIDER_LOCAL.to_string(), "--local flag");
    }

    // Priority 3: --headed without --provider
    if flags.headed {
        return (PROVIDER_LOCAL.to_string(), "--headed flag (implies local)");
    }

    // Priority 4: --cdp
    if flags.cdp.is_some() {
        return (PROVIDER_LOCAL.to_string(), "--cdp flag (implies local)");
    }

    // Priority 5: --auto-connect
    if flags.auto_connect {
        return (
            PROVIDER_LOCAL.to_string(),
            "--auto-connect flag (implies local)",
        );
    }

    // Priority 6: NST_API_KEY environment variable present
    if env::var(ENV_NST_API_KEY).is_ok() {
        return (PROVIDER_NST.to_string(), "NST_API_KEY environment variable");
    }

    // Priority 7: Default
    (PROVIDER_NST.to_string(), "default provider")
}

/// Validate Nstbrowser configuration from config file or environment variables.
/// Returns Ok(()) if valid, or Err(error_message) if invalid.
pub fn validate_nst_config() -> Result<(), String> {
    use crate::config::ConfigManager;

    // Read configuration from config file first, then fall back to environment variables
    // Priority: config file > environment variable
    let api_key = if let Ok(nst_config) = ConfigManager::read() {
        // Try config file first
        if let Some(key) = nst_config.api_key {
            key
        } else {
            // Fall back to environment variable
            match env::var(ENV_NST_API_KEY) {
                Ok(key) if !key.trim().is_empty() => key,
                Ok(_) => return Err(ERR_API_KEY_EMPTY.to_string()),
                Err(_) => return Err(ERR_API_KEY_NOT_SET.to_string()),
            }
        }
    } else {
        // Config file not available, check environment variable
        match env::var(ENV_NST_API_KEY) {
            Ok(key) if !key.trim().is_empty() => key,
            Ok(_) => return Err(ERR_API_KEY_EMPTY.to_string()),
            Err(_) => return Err(ERR_API_KEY_NOT_SET.to_string()),
        }
    };

    // Validate API key format (should be non-empty and reasonable length)
    if api_key.len() < MIN_API_KEY_LENGTH {
        return Err(format!(
            "NST_API_KEY appears invalid (too short: {} characters, expected at least {})",
            api_key.len(),
            MIN_API_KEY_LENGTH
        ));
    }

    if api_key.len() > MAX_API_KEY_LENGTH {
        return Err(format!(
            "NST_API_KEY appears invalid (too long: {} characters, expected at most {})",
            api_key.len(),
            MAX_API_KEY_LENGTH
        ));
    }

    // Validate NST_HOST if set (optional, has default)
    if let Ok(host) = env::var(ENV_NST_HOST) {
        if !host.trim().is_empty() {
            // Basic hostname/IP validation
            if host.contains("://") {
                return Err(format!(
                    "NST_HOST should be a hostname or IP address, not a URL: {}",
                    host
                ));
            }

            // Check for valid characters (alphanumeric, dots, hyphens, colons for IPv6)
            if !host
                .chars()
                .all(|c| c.is_alphanumeric() || c == '.' || c == '-' || c == ':')
            {
                return Err(format!("NST_HOST contains invalid characters: {}", host));
            }
        }
    }

    // Validate NST_PORT if set (optional, has default)
    if let Ok(port_str) = env::var(ENV_NST_PORT) {
        if !port_str.trim().is_empty() {
            match port_str.parse::<u16>() {
                Ok(0) => {
                    return Err(format!(
                        "NST_PORT must be between {} and {}",
                        MIN_PORT, MAX_PORT
                    ));
                }
                Ok(_) => {
                    // Valid port
                }
                Err(_) => {
                    return Err(format!("NST_PORT is not a valid port number: {}", port_str));
                }
            }
        }
    }

    Ok(())
}

pub fn clean_args(args: &[String]) -> Vec<String> {
    let mut result = Vec::new();
    let mut skip_next = false;

    // Boolean flags that optionally take true/false
    const GLOBAL_BOOL_FLAGS: &[&str] = &[
        "--json",
        "--full",
        "--headed",
        "--debug",
        "--ignore-https-errors",
        "--allow-file-access",
        "--auto-connect",
        "--annotate",
        "--content-boundaries",
        "--confirm-interactive",
        "--native",
        "--local",
    ];
    // Global flags that always take a value (need to skip the next arg too)
    const GLOBAL_FLAGS_WITH_VALUE: &[&str] = &[
        "--session",
        "--headers",
        "--executable-path",
        "--cdp",
        "--extension",
        "--profile",         // NST profile name
        "--profile-id",      // NST profile ID
        "--browser-profile", // Local browser profile path
        "--state",
        "--proxy",
        "--proxy-bypass",
        "--args",
        "--user-agent",
        "-p",
        "--provider",
        "--device",
        "--session-name",
        "--color-scheme",
        "--download-path",
        "--max-output",
        "--allowed-domains",
        "--action-policy",
        "--confirm-actions",
        "--config",
        "--nst-profile-name", // Deprecated, use --profile
        "--nst-profile-id",   // Deprecated, use --profile-id
    ];

    let mut i = 0;
    while i < args.len() {
        let arg = &args[i];
        if skip_next {
            skip_next = false;
            i += 1;
            continue;
        }
        if GLOBAL_FLAGS_WITH_VALUE.contains(&arg.as_str()) {
            skip_next = true;
            i += 1;
            continue;
        }
        if GLOBAL_BOOL_FLAGS.contains(&arg.as_str()) || arg == "-f" {
            if let Some(v) = args.get(i + 1) {
                if matches!(v.as_str(), "true" | "false") {
                    i += 1;
                }
            }
            i += 1;
            continue;
        }
        result.push(arg.clone());
        i += 1;
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::{
        CONFIG_DIR, CONFIG_FILE, ENV_NST_API_KEY, ENV_NST_HOST, ENV_NST_PORT, ERR_CONFIG_DIR,
        TEST_BACKUP_SUFFIX,
    };
    use std::sync::Mutex;

    // Mutex to ensure config file tests don't interfere with each other
    static CONFIG_TEST_LOCK: Mutex<()> = Mutex::new(());

    fn args(s: &str) -> Vec<String> {
        s.split_whitespace().map(String::from).collect()
    }

    /// Helper to temporarily move config file for test isolation
    struct ConfigBackup {
        config_path: PathBuf,
        backup_path: PathBuf,
        had_config: bool,
    }

    impl ConfigBackup {
        fn new() -> Self {
            let home = dirs::home_dir().expect(ERR_CONFIG_DIR);
            let config_path = home.join(CONFIG_DIR).join(CONFIG_FILE);
            let backup_path = home
                .join(CONFIG_DIR)
                .join(format!("{}{}", CONFIG_FILE, TEST_BACKUP_SUFFIX));
            let had_config = config_path.exists();

            if had_config {
                let _ = fs::rename(&config_path, &backup_path);
            }

            Self {
                config_path,
                backup_path,
                had_config,
            }
        }
    }

    impl Drop for ConfigBackup {
        fn drop(&mut self) {
            if self.had_config {
                let _ = fs::rename(&self.backup_path, &self.config_path);
            }
        }
    }

    #[test]
    fn test_parse_headers_flag() {
        let flags = parse_flags(&args(r#"open example.com --headers {"Auth":"token"}"#));
        assert_eq!(flags.headers, Some(r#"{"Auth":"token"}"#.to_string()));
    }

    #[test]
    fn test_parse_headers_flag_with_spaces() {
        // Headers JSON is passed as a single quoted argument in shell
        let input: Vec<String> = vec![
            "open".to_string(),
            "example.com".to_string(),
            "--headers".to_string(),
            r#"{"Authorization": "Bearer token"}"#.to_string(),
        ];
        let flags = parse_flags(&input);
        assert_eq!(
            flags.headers,
            Some(r#"{"Authorization": "Bearer token"}"#.to_string())
        );
    }

    #[test]
    fn test_parse_no_headers_flag() {
        let flags = parse_flags(&args("open example.com"));
        assert!(flags.headers.is_none());
    }

    #[test]
    fn test_clean_args_removes_headers() {
        let input: Vec<String> = vec![
            "open".to_string(),
            "example.com".to_string(),
            "--headers".to_string(),
            r#"{"Auth":"token"}"#.to_string(),
        ];
        let clean = clean_args(&input);
        assert_eq!(clean, vec!["open", "example.com"]);
    }

    #[test]
    fn test_clean_args_removes_headers_at_start() {
        let input: Vec<String> = vec![
            "--headers".to_string(),
            r#"{"Auth":"token"}"#.to_string(),
            "open".to_string(),
            "example.com".to_string(),
        ];
        let clean = clean_args(&input);
        assert_eq!(clean, vec!["open", "example.com"]);
    }

    #[test]
    fn test_headers_with_other_flags() {
        let input: Vec<String> = vec![
            "open".to_string(),
            "example.com".to_string(),
            "--headers".to_string(),
            r#"{"Auth":"token"}"#.to_string(),
            "--json".to_string(),
            "--headed".to_string(),
        ];
        let flags = parse_flags(&input);
        assert_eq!(flags.headers, Some(r#"{"Auth":"token"}"#.to_string()));
        assert!(flags.json);
        assert!(flags.headed);

        let clean = clean_args(&input);
        assert_eq!(clean, vec!["open", "example.com"]);
    }

    #[test]
    fn test_parse_executable_path_flag() {
        let flags = parse_flags(&args(
            "--executable-path /path/to/chromium open example.com",
        ));
        assert_eq!(flags.executable_path, Some("/path/to/chromium".to_string()));
    }

    #[test]
    fn test_parse_executable_path_flag_no_value() {
        let flags = parse_flags(&args("--executable-path"));
        assert_eq!(flags.executable_path, None);
    }

    #[test]
    fn test_clean_args_removes_executable_path() {
        let cleaned = clean_args(&args(
            "--executable-path /path/to/chromium open example.com",
        ));
        assert_eq!(cleaned, vec!["open", "example.com"]);
    }

    #[test]
    fn test_clean_args_removes_executable_path_with_other_flags() {
        let cleaned = clean_args(&args(
            "--json --executable-path /path/to/chromium --headed open example.com",
        ));
        assert_eq!(cleaned, vec!["open", "example.com"]);
    }

    #[test]
    fn test_parse_flags_with_session_and_executable_path() {
        let flags = parse_flags(&args(
            "--session test --executable-path /custom/chrome open example.com",
        ));
        assert_eq!(flags.session, "test");
        assert_eq!(flags.executable_path, Some("/custom/chrome".to_string()));
    }

    #[test]
    fn test_cli_executable_path_tracking() {
        // When --executable-path is passed via CLI, cli_executable_path should be true
        let flags = parse_flags(&args("--executable-path /path/to/chrome snapshot"));
        assert!(flags.cli_executable_path);
        assert_eq!(flags.executable_path, Some("/path/to/chrome".to_string()));
    }

    #[test]
    fn test_cli_executable_path_not_set_without_flag() {
        // When no --executable-path is passed, cli_executable_path should be false
        // (even if env var sets executable_path to Some value, which we can't test here)
        let flags = parse_flags(&args("snapshot"));
        assert!(!flags.cli_executable_path);
    }

    #[test]
    fn test_cli_extension_tracking() {
        let flags = parse_flags(&args("--extension /path/to/ext snapshot"));
        assert!(flags.cli_extensions);
    }

    #[test]
    fn test_cli_profile_tracking() {
        let flags = parse_flags(&args("--browser-profile /path/to/profile snapshot"));
        assert!(flags.cli_profile);
    }

    #[test]
    fn test_cli_annotate_tracking() {
        let flags = parse_flags(&args("--annotate screenshot"));
        assert!(flags.cli_annotate);
        assert!(flags.annotate);
    }

    #[test]
    fn test_cli_annotate_not_set_without_flag() {
        let flags = parse_flags(&args("screenshot"));
        assert!(!flags.cli_annotate);
    }

    #[test]
    fn test_cli_download_path_tracking() {
        let flags = parse_flags(&args("--download-path /tmp/dl snapshot"));
        assert!(flags.cli_download_path);
        assert_eq!(flags.download_path, Some("/tmp/dl".to_string()));
    }

    #[test]
    fn test_cli_download_path_not_set_without_flag() {
        let flags = parse_flags(&args("snapshot"));
        assert!(!flags.cli_download_path);
    }

    #[test]
    fn test_cli_multiple_flags_tracking() {
        let flags = parse_flags(&args(
            "--executable-path /chrome --browser-profile /profile --proxy http://proxy snapshot",
        ));
        assert!(flags.cli_executable_path);
        assert!(flags.cli_profile);
        assert!(flags.cli_proxy);
        assert!(!flags.cli_extensions);
        assert!(!flags.cli_state);
    }

    // === Config file tests ===

    #[test]
    fn test_config_deserialize_full() {
        let json = r#"{
            "headed": true,
            "json": true,
            "full": true,
            "debug": true,
            "session": "test-session",
            "sessionName": "my-app",
            "executablePath": "/usr/bin/chromium",
            "extensions": ["/ext1", "/ext2"],
            "profile": "/tmp/profile",
            "state": "/tmp/state.json",
            "proxy": "http://proxy:8080",
            "proxyBypass": "localhost",
            "args": "--no-sandbox",
            "userAgent": "test-agent",
            "provider": "nst",
            "ignoreHttpsErrors": true,
            "allowFileAccess": true,
            "cdp": "9222",
            "autoConnect": true,
            "headers": "{\"Auth\":\"token\"}"
        }"#;
        let config: Config = serde_json::from_str(json).unwrap();
        assert_eq!(config.headed, Some(true));
        assert_eq!(config.json, Some(true));
        assert_eq!(config.full, Some(true));
        assert_eq!(config.debug, Some(true));
        assert_eq!(config.session.as_deref(), Some("test-session"));
        assert_eq!(config.session_name.as_deref(), Some("my-app"));
        assert_eq!(config.executable_path.as_deref(), Some("/usr/bin/chromium"));
        assert_eq!(
            config.extensions,
            Some(vec!["/ext1".to_string(), "/ext2".to_string()])
        );
        assert_eq!(config.profile.as_deref(), Some("/tmp/profile"));
        assert_eq!(config.state.as_deref(), Some("/tmp/state.json"));
        assert_eq!(config.proxy.as_deref(), Some("http://proxy:8080"));
        assert_eq!(config.proxy_bypass.as_deref(), Some("localhost"));
        assert_eq!(config.args.as_deref(), Some("--no-sandbox"));
        assert_eq!(config.user_agent.as_deref(), Some("test-agent"));
        assert_eq!(config.provider.as_deref(), Some("nst"));
        assert_eq!(config.ignore_https_errors, Some(true));
        assert_eq!(config.allow_file_access, Some(true));
        assert_eq!(config.cdp.as_deref(), Some("9222"));
        assert_eq!(config.auto_connect, Some(true));
        assert_eq!(config.headers.as_deref(), Some("{\"Auth\":\"token\"}"));
    }

    #[test]
    fn test_config_deserialize_partial() {
        let json = r#"{"headed": true, "proxy": "http://localhost:8080"}"#;
        let config: Config = serde_json::from_str(json).unwrap();
        assert_eq!(config.headed, Some(true));
        assert_eq!(config.proxy.as_deref(), Some("http://localhost:8080"));
        assert_eq!(config.session, None);
        assert_eq!(config.extensions, None);
        assert_eq!(config.debug, None);
    }

    #[test]
    fn test_config_deserialize_empty() {
        let config: Config = serde_json::from_str("{}").unwrap();
        assert_eq!(config.headed, None);
        assert_eq!(config.session, None);
        assert_eq!(config.proxy, None);
    }

    #[test]
    fn test_config_ignores_unknown_keys() {
        let json = r#"{"headed": true, "unknownFutureKey": "value", "anotherOne": 42}"#;
        let config: Config = serde_json::from_str(json).unwrap();
        assert_eq!(config.headed, Some(true));
    }

    #[test]
    fn test_config_merge_project_overrides_user() {
        let user = Config {
            headed: Some(true),
            proxy: Some("http://user-proxy:8080".to_string()),
            profile: Some("/user/profile".to_string()),
            ..Config::default()
        };
        let project = Config {
            proxy: Some("http://project-proxy:9090".to_string()),
            debug: Some(true),
            ..Config::default()
        };
        let merged = user.merge(project);
        assert_eq!(merged.headed, Some(true)); // kept from user
        assert_eq!(merged.proxy.as_deref(), Some("http://project-proxy:9090")); // overridden by project
        assert_eq!(merged.profile.as_deref(), Some("/user/profile")); // kept from user
        assert_eq!(merged.debug, Some(true)); // added by project
    }

    #[test]
    fn test_config_merge_none_does_not_override() {
        let user = Config {
            headed: Some(true),
            proxy: Some("http://proxy:8080".to_string()),
            ..Config::default()
        };
        let project = Config::default();
        let merged = user.merge(project);
        assert_eq!(merged.headed, Some(true));
        assert_eq!(merged.proxy.as_deref(), Some("http://proxy:8080"));
    }

    #[test]
    fn test_load_config_from_file() {
        use std::io::Write;
        let dir = std::env::temp_dir().join("ab-test-config");
        let _ = fs::create_dir_all(&dir);
        let config_path = dir.join("test-config.json");
        let mut f = fs::File::create(&config_path).unwrap();
        writeln!(f, r#"{{"headed": true, "proxy": "http://test:1234"}}"#).unwrap();

        let config = read_config_file(&config_path).unwrap();
        assert_eq!(config.headed, Some(true));
        assert_eq!(config.proxy.as_deref(), Some("http://test:1234"));

        let _ = fs::remove_file(&config_path);
        let _ = fs::remove_dir(&dir);
    }

    #[test]
    fn test_load_config_missing_file_returns_none() {
        let result = read_config_file(&PathBuf::from("/nonexistent/nstbrowser-ai-agent.json"));
        assert!(result.is_none());
    }

    #[test]
    fn test_load_config_malformed_json_returns_none() {
        use std::io::Write;
        let dir = std::env::temp_dir().join("ab-test-malformed");
        let _ = fs::create_dir_all(&dir);
        let config_path = dir.join("bad-config.json");
        let mut f = fs::File::create(&config_path).unwrap();
        writeln!(f, "{{not valid json}}").unwrap();

        let result = read_config_file(&config_path);
        assert!(result.is_none());

        let _ = fs::remove_file(&config_path);
        let _ = fs::remove_dir(&dir);
    }

    #[test]
    fn test_extract_config_path() {
        assert_eq!(
            extract_config_path(&args("--config ./my-config.json open example.com")),
            Some(Some("./my-config.json".to_string()))
        );
    }

    #[test]
    fn test_extract_config_path_missing() {
        assert_eq!(extract_config_path(&args("open example.com")), None);
    }

    #[test]
    fn test_extract_config_path_no_value() {
        assert_eq!(extract_config_path(&args("--config")), Some(None));
    }

    #[test]
    fn test_extract_config_path_skips_flag_values() {
        assert_eq!(extract_config_path(&args("--args --config open")), None);
    }

    #[test]
    fn test_clean_args_removes_config() {
        let cleaned = clean_args(&args("--config ./config.json open example.com"));
        assert_eq!(cleaned, vec!["open", "example.com"]);
    }

    #[test]
    fn test_load_config_with_config_flag() {
        use std::io::Write;
        let dir = std::env::temp_dir().join("ab-test-flag-config");
        let _ = fs::create_dir_all(&dir);
        let config_path = dir.join("custom.json");
        let mut f = fs::File::create(&config_path).unwrap();
        writeln!(f, r#"{{"headed": true, "session": "custom"}}"#).unwrap();

        let flag_args = vec![
            "--config".to_string(),
            config_path.to_string_lossy().to_string(),
            "open".to_string(),
            "example.com".to_string(),
        ];
        let config = load_config(&flag_args).unwrap();
        assert_eq!(config.headed, Some(true));
        assert_eq!(config.session.as_deref(), Some("custom"));

        let _ = fs::remove_file(&config_path);
        let _ = fs::remove_dir(&dir);
    }

    #[test]
    fn test_load_config_error_missing_config_value() {
        let result = load_config(&args("--config"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("requires a file path"));
    }

    #[test]
    fn test_load_config_error_nonexistent_file() {
        let result = load_config(&args("--config /nonexistent/config.json open"));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("config file not found"));
    }

    #[test]
    fn test_load_config_error_malformed_explicit() {
        use std::io::Write;
        let dir = std::env::temp_dir().join("ab-test-explicit-malformed");
        let _ = fs::create_dir_all(&dir);
        let config_path = dir.join("bad.json");
        let mut f = fs::File::create(&config_path).unwrap();
        writeln!(f, "{{not valid}}").unwrap();

        let flag_args = vec![
            "--config".to_string(),
            config_path.to_string_lossy().to_string(),
        ];
        let result = load_config(&flag_args);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("failed to load config"));

        let _ = fs::remove_file(&config_path);
        let _ = fs::remove_dir(&dir);
    }

    // === Boolean flag value tests ===

    #[test]
    fn test_headed_false() {
        let flags = parse_flags(&args("--headed false open example.com"));
        assert!(!flags.headed);
    }

    #[test]
    fn test_headed_true_explicit() {
        let flags = parse_flags(&args("--headed true open example.com"));
        assert!(flags.headed);
    }

    #[test]
    fn test_headed_bare_defaults_true() {
        let flags = parse_flags(&args("--headed open example.com"));
        assert!(flags.headed);
    }

    #[test]
    fn test_debug_false() {
        let flags = parse_flags(&args("--debug false open example.com"));
        assert!(!flags.debug);
    }

    #[test]
    fn test_json_false() {
        let flags = parse_flags(&args("--json false open example.com"));
        assert!(!flags.json);
    }

    #[test]
    fn test_ignore_https_errors_false() {
        let flags = parse_flags(&args("--ignore-https-errors false open"));
        assert!(!flags.ignore_https_errors);
    }

    #[test]
    fn test_allow_file_access_false() {
        let flags = parse_flags(&args("--allow-file-access false open"));
        assert!(!flags.allow_file_access);
        assert!(flags.cli_allow_file_access);
    }

    #[test]
    fn test_auto_connect_false() {
        let flags = parse_flags(&args("--auto-connect false open"));
        assert!(!flags.auto_connect);
    }

    #[test]
    fn test_full_bare_defaults_true() {
        let flags = parse_flags(&args("--full open example.com"));
        assert!(flags.full);
    }

    #[test]
    fn test_full_false() {
        let flags = parse_flags(&args("--full false open example.com"));
        assert!(!flags.full);
    }

    #[test]
    fn test_full_short_flag() {
        let flags = parse_flags(&args("-f open example.com"));
        assert!(flags.full);
    }

    #[test]
    fn test_clean_args_removes_full_with_value() {
        let cleaned = clean_args(&args("--full false open example.com"));
        assert_eq!(cleaned, vec!["open", "example.com"]);
    }

    #[test]
    fn test_clean_args_removes_short_full() {
        let cleaned = clean_args(&args("-f open example.com"));
        assert_eq!(cleaned, vec!["open", "example.com"]);
    }

    #[test]
    fn test_clean_args_removes_bool_flag_with_value() {
        let cleaned = clean_args(&args("--headed false --debug true open example.com"));
        assert_eq!(cleaned, vec!["open", "example.com"]);
    }

    #[test]
    fn test_clean_args_removes_bare_bool_flag() {
        let cleaned = clean_args(&args("--headed --debug open example.com"));
        assert_eq!(cleaned, vec!["open", "example.com"]);
    }

    // === Extensions merge tests ===

    #[test]
    fn test_config_merge_extensions_concatenated() {
        let user = Config {
            extensions: Some(vec!["/ext1".to_string()]),
            ..Config::default()
        };
        let project = Config {
            extensions: Some(vec!["/ext2".to_string(), "/ext3".to_string()]),
            ..Config::default()
        };
        let merged = user.merge(project);
        assert_eq!(
            merged.extensions,
            Some(vec![
                "/ext1".to_string(),
                "/ext2".to_string(),
                "/ext3".to_string()
            ])
        );
    }

    #[test]
    fn test_config_merge_extensions_user_only() {
        let user = Config {
            extensions: Some(vec!["/ext1".to_string()]),
            ..Config::default()
        };
        let project = Config::default();
        let merged = user.merge(project);
        assert_eq!(merged.extensions, Some(vec!["/ext1".to_string()]));
    }

    #[test]
    fn test_config_merge_extensions_project_only() {
        let user = Config::default();
        let project = Config {
            extensions: Some(vec!["/ext2".to_string()]),
            ..Config::default()
        };
        let merged = user.merge(project);
        assert_eq!(merged.extensions, Some(vec!["/ext2".to_string()]));
    }

    // === Provider selection tests ===

    #[test]
    fn test_provider_explicit_flag_takes_priority() {
        let flags = parse_flags(&args("--provider nst open example.com"));
        assert_eq!(flags.provider.as_deref(), Some("nst"));
    }

    #[test]
    fn test_provider_local_flag() {
        let flags = parse_flags(&args("--local open example.com"));
        assert_eq!(flags.provider.as_deref(), Some("local"));
        assert!(flags.local);
    }

    #[test]
    fn test_provider_headed_implies_local() {
        let flags = parse_flags(&args("--headed open example.com"));
        assert_eq!(flags.provider.as_deref(), Some("local"));
    }

    #[test]
    fn test_provider_cdp_implies_local() {
        let flags = parse_flags(&args("--cdp 9222 open example.com"));
        assert_eq!(flags.provider.as_deref(), Some("local"));
    }

    #[test]
    fn test_provider_auto_connect_implies_local() {
        let flags = parse_flags(&args("--auto-connect open example.com"));
        assert_eq!(flags.provider.as_deref(), Some("local"));
    }

    #[test]
    fn test_provider_explicit_overrides_local() {
        let flags = parse_flags(&args("--provider nst --local open example.com"));
        assert_eq!(flags.provider.as_deref(), Some("nst"));
    }

    #[test]
    fn test_provider_explicit_overrides_headed() {
        let flags = parse_flags(&args("--provider nst --headed open example.com"));
        assert_eq!(flags.provider.as_deref(), Some("nst"));
    }

    #[test]
    fn test_provider_local_overrides_headed() {
        let flags = parse_flags(&args("--local --headed open example.com"));
        assert_eq!(flags.provider.as_deref(), Some("local"));
    }

    #[test]
    fn test_local_flag_false() {
        let flags = parse_flags(&args("--local false open example.com"));
        assert!(!flags.local);
        // When --local is false and no other flags, should default to "nst"
        assert_eq!(flags.provider.as_deref(), Some("nst"));
    }

    #[test]
    fn test_clean_args_removes_local() {
        let cleaned = clean_args(&args("--local open example.com"));
        assert_eq!(cleaned, vec!["open", "example.com"]);
    }

    #[test]
    fn test_clean_args_removes_local_with_value() {
        let cleaned = clean_args(&args("--local true open example.com"));
        assert_eq!(cleaned, vec!["open", "example.com"]);
    }

    // === Configuration validation tests ===

    #[test]
    fn test_validate_nst_config_missing_api_key() {
        let _lock = CONFIG_TEST_LOCK.lock().unwrap();
        let _backup = ConfigBackup::new();

        env::remove_var(ENV_NST_API_KEY);
        let result = validate_nst_config();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains(ERR_API_KEY_NOT_SET));
    }

    #[test]
    fn test_validate_nst_config_empty_api_key() {
        let _lock = CONFIG_TEST_LOCK.lock().unwrap();
        let _backup = ConfigBackup::new();

        env::remove_var(ENV_NST_API_KEY);
        env::remove_var(ENV_NST_HOST);
        env::remove_var(ENV_NST_PORT);

        env::set_var(ENV_NST_API_KEY, "");
        let result = validate_nst_config();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("empty"));
        env::remove_var(ENV_NST_API_KEY);
    }

    #[test]
    fn test_validate_nst_config_short_api_key() {
        let _lock = CONFIG_TEST_LOCK.lock().unwrap();
        let _backup = ConfigBackup::new();

        env::remove_var(ENV_NST_API_KEY);
        env::remove_var(ENV_NST_HOST);
        env::remove_var(ENV_NST_PORT);

        env::set_var(ENV_NST_API_KEY, "short");
        let result = validate_nst_config();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("too short"));
        env::remove_var(ENV_NST_API_KEY);
    }

    #[test]
    fn test_validate_nst_config_valid_api_key() {
        let _lock = CONFIG_TEST_LOCK.lock().unwrap();
        let _backup = ConfigBackup::new();

        env::remove_var(ENV_NST_API_KEY);
        env::remove_var(ENV_NST_HOST);
        env::remove_var(ENV_NST_PORT);

        env::set_var(ENV_NST_API_KEY, "valid-api-key-1234567890");
        let result = validate_nst_config();
        assert!(result.is_ok());
        env::remove_var(ENV_NST_API_KEY);
    }

    #[test]
    fn test_validate_nst_config_invalid_host_with_protocol() {
        let _lock = CONFIG_TEST_LOCK.lock().unwrap();

        env::set_var(ENV_NST_API_KEY, "valid-api-key-1234567890");
        env::set_var(ENV_NST_HOST, "https://example.com");
        let result = validate_nst_config();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not a URL"));
        env::remove_var(ENV_NST_API_KEY);
        env::remove_var(ENV_NST_HOST);
    }

    #[test]
    fn test_validate_nst_config_valid_host() {
        let _lock = CONFIG_TEST_LOCK.lock().unwrap();

        env::set_var(ENV_NST_API_KEY, "valid-api-key-1234567890");
        env::set_var(ENV_NST_HOST, "api.nstbrowser.io");
        let result = validate_nst_config();
        assert!(result.is_ok());
        env::remove_var(ENV_NST_API_KEY);
        env::remove_var(ENV_NST_HOST);
    }

    #[test]
    fn test_validate_nst_config_invalid_port_zero() {
        let _lock = CONFIG_TEST_LOCK.lock().unwrap();
        let _backup = ConfigBackup::new();

        env::set_var(ENV_NST_API_KEY, "valid-api-key-1234567890");
        env::set_var(ENV_NST_PORT, "0");
        let result = validate_nst_config();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("between 1 and 65535"));
        env::remove_var(ENV_NST_API_KEY);
        env::remove_var(ENV_NST_PORT);
    }

    #[test]
    fn test_validate_nst_config_invalid_port_non_numeric() {
        let _lock = CONFIG_TEST_LOCK.lock().unwrap();
        let _backup = ConfigBackup::new();

        env::set_var(ENV_NST_API_KEY, "valid-api-key-1234567890");
        env::set_var(ENV_NST_PORT, "abc");
        let result = validate_nst_config();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not a valid port number"));
        env::remove_var(ENV_NST_API_KEY);
        env::remove_var(ENV_NST_PORT);
    }

    #[test]
    fn test_validate_nst_config_valid_port() {
        let _lock = CONFIG_TEST_LOCK.lock().unwrap();

        env::set_var(ENV_NST_API_KEY, "valid-api-key-1234567890");
        env::set_var(ENV_NST_PORT, "8080");
        let result = validate_nst_config();
        assert!(result.is_ok());
        env::remove_var(ENV_NST_API_KEY);
        env::remove_var(ENV_NST_PORT);
    }

    // === .env file loading tests ===

    #[test]
    fn test_load_env_files_no_file() {
        // This should not panic when no .env file exists
        load_env_files();
        // Test passes if no panic occurs
    }

    #[test]
    #[ignore] // Requires serial execution due to dotenvy global state
    fn test_load_env_files_with_project_env() {
        use crate::constants::{ENV_NST_API_KEY, ENV_NST_HOST, ENV_NST_PORT, PROJECT_ENV_FILE};
        use std::io::Write;

        // Clean up any existing test environment variables first
        env::remove_var("TEST_VAR_PROJECT");
        env::remove_var(ENV_NST_API_KEY);
        env::remove_var(ENV_NST_HOST);
        env::remove_var(ENV_NST_PORT);

        let dir = env::temp_dir().join("ab-test-env-project");
        let _ = fs::create_dir_all(&dir);
        let env_path = dir.join(PROJECT_ENV_FILE);

        // Create test .env file
        let mut f = fs::File::create(&env_path).unwrap();
        writeln!(f, "TEST_VAR_PROJECT=project_value").unwrap();
        drop(f);

        // Change to test directory
        let original_dir = env::current_dir().unwrap();
        env::set_current_dir(&dir).unwrap();

        // Load env files
        load_env_files();

        // Verify variable was loaded
        assert_eq!(
            env::var("TEST_VAR_PROJECT").ok(),
            Some("project_value".to_string())
        );

        // Cleanup
        env::set_current_dir(original_dir).unwrap();
        env::remove_var("TEST_VAR_PROJECT");
        let _ = fs::remove_file(&env_path);
        let _ = fs::remove_dir(&dir);
    }

    #[test]
    #[ignore] // Requires serial execution due to dotenvy global state
    fn test_load_env_files_with_standard_env() {
        use crate::constants::{
            ENV_NST_API_KEY, ENV_NST_HOST, ENV_NST_PORT, PROJECT_ENV_FILE, STANDARD_ENV_FILE,
        };
        use std::io::Write;

        // Clean up any existing test environment variables first
        env::remove_var("TEST_VAR_STANDARD");
        env::remove_var(ENV_NST_API_KEY);
        env::remove_var(ENV_NST_HOST);
        env::remove_var(ENV_NST_PORT);

        let dir = env::temp_dir().join("ab-test-env-standard");
        let _ = fs::create_dir_all(&dir);
        let env_path = dir.join(STANDARD_ENV_FILE);
        let project_env_path = dir.join(PROJECT_ENV_FILE);

        // Ensure project-specific env file doesn't exist (so standard .env is used)
        let _ = fs::remove_file(&project_env_path);

        // Create test .env file
        let mut f = fs::File::create(&env_path).unwrap();
        writeln!(f, "TEST_VAR_STANDARD=standard_value").unwrap();
        drop(f);

        // Change to test directory
        let original_dir = env::current_dir().unwrap();
        env::set_current_dir(&dir).unwrap();

        // Load env files
        load_env_files();

        // Verify variable was loaded
        assert_eq!(
            env::var("TEST_VAR_STANDARD").ok(),
            Some("standard_value".to_string())
        );

        // Cleanup
        env::set_current_dir(original_dir).unwrap();
        env::remove_var("TEST_VAR_STANDARD");
        let _ = fs::remove_file(&env_path);
        let _ = fs::remove_dir(&dir);
    }

    #[test]
    #[ignore] // Requires serial execution due to dotenvy global state
    fn test_load_env_files_priority() {
        use crate::constants::{PROJECT_ENV_FILE, STANDARD_ENV_FILE};
        use std::io::Write;

        let dir = env::temp_dir().join("ab-test-env-priority");
        let _ = fs::create_dir_all(&dir);
        let project_env_path = dir.join(PROJECT_ENV_FILE);
        let standard_env_path = dir.join(STANDARD_ENV_FILE);

        // Create both .env files with different values
        let mut f1 = fs::File::create(&project_env_path).unwrap();
        writeln!(f1, "TEST_VAR_PRIORITY=project_wins").unwrap();
        drop(f1);

        let mut f2 = fs::File::create(&standard_env_path).unwrap();
        writeln!(f2, "TEST_VAR_PRIORITY=standard_loses").unwrap();
        drop(f2);

        // Change to test directory
        let original_dir = env::current_dir().unwrap();
        env::set_current_dir(&dir).unwrap();

        // Load env files
        load_env_files();

        // Verify project-specific file takes priority
        assert_eq!(
            env::var("TEST_VAR_PRIORITY").ok(),
            Some("project_wins".to_string())
        );

        // Cleanup
        env::set_current_dir(original_dir).unwrap();
        env::remove_var("TEST_VAR_PRIORITY");
        let _ = fs::remove_file(&project_env_path);
        let _ = fs::remove_file(&standard_env_path);
        let _ = fs::remove_dir(&dir);
    }
}
