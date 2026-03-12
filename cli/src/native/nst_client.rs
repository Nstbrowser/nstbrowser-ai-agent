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
}

impl NstClient {
    pub fn new(host: &str, port: u16, api_key: &str) -> Self {
        Self {
            base_url: format!("http://{}:{}", host, port),
            api_key: api_key.to_string(),
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
            return Err(format!("HTTP {}: {}", status, error_text));
        }

        response
            .json::<T>()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }
}
