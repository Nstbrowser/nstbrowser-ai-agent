/// Simplified NST API client for profile resolution
///
/// This is a minimal client implementation focused on profile resolution needs.
/// For full API coverage, see the Node.js implementation in src/nstbrowser-client.ts
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Clone, Deserialize)]
pub struct RunningBrowser {
    #[serde(rename = "profileId")]
    pub profile_id: Option<String>,
    pub name: Option<String>,
    pub running: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NstProfile {
    #[serde(rename = "profileId")]
    pub profile_id: String,
    pub name: String,
    pub platform: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
struct NstApiResponse<T> {
    err: bool,
    msg: Option<String>,
    code: Option<i32>,
    data: Option<T>,
}

#[derive(Debug, Clone, Deserialize)]
struct ProfileListResponse {
    docs: Vec<NstProfile>,
}

pub struct NstClient {
    base_url: String,
    api_key: String,
    host: String,
    port: u16,
    ci_header: String,
}

impl NstClient {
    pub fn new(host: &str, port: u16, api_key: &str) -> Self {
        let ci_header = format!(
            "nstbrowser-ai-agent/{}; native/{}",
            env!("CARGO_PKG_VERSION"),
            env!("CARGO_PKG_VERSION")
        );

        Self {
            base_url: format!("http://{}:{}", host, port),
            api_key: api_key.to_string(),
            host: host.to_string(),
            port,
            ci_header,
        }
    }

    /// Check if NST agent is running and responsive
    pub async fn check_agent_info(&self) -> Result<bool, String> {
        let url = format!("{}/api/agent/agent/info", self.base_url);
        
        match self.request::<Value>("GET", &url, None).await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    /// Get all running browser instances
    pub async fn get_browsers(&self) -> Result<Vec<RunningBrowser>, String> {
        let url = format!("{}/api/v2/browsers", self.base_url);
        let response: NstApiResponse<Vec<RunningBrowser>> = self.request("GET", &url, None).await?;

        if response.err {
            return Err(response.msg.unwrap_or_else(|| "Unknown error".to_string()));
        }

        Ok(response.data.unwrap_or_default())
    }

    /// Get profiles with optional name filter
    pub async fn get_profiles(&self, name_filter: Option<&str>) -> Result<Vec<NstProfile>, String> {
        let mut url = format!("{}/api/v2/profiles", self.base_url);

        if let Some(name) = name_filter {
            url = format!("{}?s={}", url, urlencoding::encode(name));
        }

        let response: NstApiResponse<ProfileListResponse> = self.request("GET", &url, None).await?;

        if response.err {
            return Err(response.msg.unwrap_or_else(|| "Unknown error".to_string()));
        }

        Ok(response.data.map(|r| r.docs).unwrap_or_default())
    }

    /// Create a new profile
    pub async fn create_profile(&self, name: &str) -> Result<NstProfile, String> {
        let url = format!("{}/api/v2/profiles", self.base_url);
        let body = json!({ "name": name });

        let response: NstApiResponse<NstProfile> = self.request("POST", &url, Some(&body)).await?;

        if response.err {
            return Err(response.msg.unwrap_or_else(|| "Unknown error".to_string()));
        }

        response
            .data
            .ok_or_else(|| "No profile data in response".to_string())
    }

    /// Start a browser for a profile
    pub async fn start_browser(&self, profile_id: &str) -> Result<(), String> {
        let url = format!("{}/api/v2/browsers/{}", self.base_url, profile_id);

        let response: NstApiResponse<Value> = self.request("POST", &url, None).await?;

        if response.err {
            return Err(response.msg.unwrap_or_else(|| "Unknown error".to_string()));
        }

        Ok(())
    }

    /// Make HTTP request to NST API
    async fn request<T: serde::de::DeserializeOwned>(
        &self,
        method: &str,
        url: &str,
        body: Option<&Value>,
    ) -> Result<T, String> {
        let client = reqwest::Client::new();

        let mut req = match method {
            "GET" => client.get(url),
            "POST" => client.post(url),
            "PUT" => client.put(url),
            "DELETE" => client.delete(url),
            _ => return Err(format!("Unsupported HTTP method: {}", method)),
        };

        req = req.header("x-api-key", &self.api_key);
        req = req.header("Content-Type", "application/json");
        req = req.header("ci", &self.ci_header);

        if let Some(b) = body {
            req = req.json(b);
        }

        let response = req
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "No error details".to_string());
            
            // Create structured error message with diagnostic information
            let error_msg = match status.as_u16() {
                400 => {
                    format!(
                        "NST Service Error (HTTP 400): {}\n\nDiagnostic Information:\n• The Nstbrowser desktop client may not be running\n• API endpoint may not be accessible\n• Request format may be invalid\n\nTroubleshooting Steps:\n1. Start the Nstbrowser desktop client\n2. Check if port {} is accessible: curl http://{}:{}\n3. Verify API key: nstbrowser-ai-agent config show\n4. Check service status: nstbrowser-ai-agent status\n\nFor more help: https://github.com/nstbrowser/nstbrowser-ai-agent#troubleshooting",
                        error_text, self.port, self.host, self.port
                    )
                }
                401 => {
                    format!(
                        "NST Authentication Error (HTTP 401): {}\n\nDiagnostic Information:\n• API key is missing or invalid\n• API key may have expired\n\nTroubleshooting Steps:\n1. Set your API key: nstbrowser-ai-agent config set key YOUR_API_KEY\n2. Verify API key: nstbrowser-ai-agent config show\n3. Check if API key is valid in Nstbrowser dashboard\n\nFor more help: https://github.com/nstbrowser/nstbrowser-ai-agent#troubleshooting",
                        error_text
                    )
                }
                403 => {
                    format!(
                        "NST Permission Error (HTTP 403): {}\n\nDiagnostic Information:\n• API key lacks required permissions\n• Resource access is restricted\n\nTroubleshooting Steps:\n1. Check API key permissions in Nstbrowser dashboard\n2. Verify you have access to the requested resource\n3. Contact support if permissions appear correct\n\nFor more help: https://github.com/nstbrowser/nstbrowser-ai-agent#troubleshooting",
                        error_text
                    )
                }
                404 => {
                    format!(
                        "NST Resource Not Found (HTTP 404): {}\n\nDiagnostic Information:\n• Profile ID or name does not exist\n• Browser instance may have been stopped\n• API endpoint may be incorrect\n\nTroubleshooting Steps:\n1. List available profiles: nstbrowser-ai-agent profile list\n2. Check running browsers: nstbrowser-ai-agent browser list\n3. Verify profile ID format (UUID) or name spelling\n4. Create profile if needed: nstbrowser-ai-agent profile create <name>\n\nFor more help: https://github.com/nstbrowser/nstbrowser-ai-agent#troubleshooting",
                        error_text
                    )
                }
                500..=599 => {
                    format!(
                        "NST Server Error (HTTP {}): {}\n\nDiagnostic Information:\n• Nstbrowser service encountered an internal error\n• Service may be overloaded or misconfigured\n\nTroubleshooting Steps:\n1. Wait a moment and try again\n2. Restart the Nstbrowser desktop client\n3. Check Nstbrowser service logs\n4. Contact support if problem persists\n\nFor more help: https://github.com/nstbrowser/nstbrowser-ai-agent#troubleshooting",
                        status.as_u16(), error_text
                    )
                }
                _ => {
                    format!(
                        "NST Service Error (HTTP {}): {}\n\nDiagnostic Information:\n• Unexpected HTTP status code\n• Service may be unavailable\n\nTroubleshooting Steps:\n1. Check if Nstbrowser desktop client is running\n2. Verify network connectivity to {}:{}\n3. Check service status: nstbrowser-ai-agent status\n\nFor more help: https://github.com/nstbrowser/nstbrowser-ai-agent#troubleshooting",
                        status.as_u16(), error_text, self.host, self.port
                    )
                }
            };
            
            return Err(error_msg);
        }

        response
            .json::<T>()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }
}
