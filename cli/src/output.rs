use std::sync::OnceLock;

use crate::color;
use crate::connection::Response;

static BOUNDARY_NONCE: OnceLock<String> = OnceLock::new();

/// Per-process nonce for content boundary markers. Uses a CSPRNG (getrandom) so
/// that untrusted page content cannot predict or spoof the boundary delimiter.
/// Process ID or timestamps would be insufficient since pages can read those.
fn get_boundary_nonce() -> &'static str {
    BOUNDARY_NONCE.get_or_init(|| {
        let mut buf = [0u8; 16];
        getrandom::getrandom(&mut buf).expect("failed to generate random nonce");
        buf.iter().map(|b| format!("{:02x}", b)).collect()
    })
}

#[derive(Default)]
pub struct OutputOptions {
    pub json: bool,
    pub content_boundaries: bool,
    pub max_output: Option<usize>,
}

fn truncate_if_needed(content: &str, max: Option<usize>) -> String {
    let Some(limit) = max else {
        return content.to_string();
    };
    // Fast path: byte length is a lower bound on char count, so if the
    // byte length is within the limit the char count must be too.
    if content.len() <= limit {
        return content.to_string();
    }
    // Find the byte offset of the limit-th character.
    match content.char_indices().nth(limit).map(|(i, _)| i) {
        Some(byte_offset) => {
            let total_chars = content.chars().count();
            format!(
                "{}\n[truncated: showing {} of {} chars. Use --max-output to adjust]",
                &content[..byte_offset],
                limit,
                total_chars
            )
        }
        // Content has fewer than `limit` chars despite more bytes
        None => content.to_string(),
    }
}

fn print_with_boundaries(content: &str, origin: Option<&str>, opts: &OutputOptions) {
    let content = truncate_if_needed(content, opts.max_output);
    if opts.content_boundaries {
        let origin_str = origin.unwrap_or("unknown");
        let nonce = get_boundary_nonce();
        println!(
            "--- NSTBROWSER_AI_AGENT_PAGE_CONTENT nonce={} origin={} ---",
            nonce, origin_str
        );
        println!("{}", content);
        println!(
            "--- END_NSTBROWSER_AI_AGENT_PAGE_CONTENT nonce={} ---",
            nonce
        );
    } else {
        println!("{}", content);
    }
}

pub fn print_response_with_opts(resp: &Response, action: Option<&str>, opts: &OutputOptions) {
    if opts.json {
        if opts.content_boundaries {
            let mut json_val = serde_json::to_value(resp).unwrap_or_default();
            if let Some(obj) = json_val.as_object_mut() {
                let nonce = get_boundary_nonce();
                let origin = obj
                    .get("data")
                    .and_then(|d| d.get("origin"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                obj.insert(
                    "_boundary".to_string(),
                    serde_json::json!({
                        "nonce": nonce,
                        "origin": origin,
                    }),
                );
            }
            println!("{}", serde_json::to_string(&json_val).unwrap_or_default());
        } else {
            println!("{}", serde_json::to_string(resp).unwrap_or_default());
        }
        return;
    }

    if !resp.success {
        eprintln!(
            "{} {}",
            color::error_indicator(),
            resp.error.as_deref().unwrap_or("Unknown error")
        );
        return;
    }

    if let Some(data) = &resp.data {
        // Navigation response
        if let Some(url) = data.get("url").and_then(|v| v.as_str()) {
            if let Some(title) = data.get("title").and_then(|v| v.as_str()) {
                println!("{} {}", color::success_indicator(), color::bold(title));
                println!("  {}", color::dim(url));
                return;
            }
            println!("{}", url);
            return;
        }
        // Diff responses -- route by action to avoid fragile shape probing
        if let Some(obj) = data.as_object() {
            match action {
                Some("diff_snapshot") => {
                    print_snapshot_diff(obj);
                    return;
                }
                Some("diff_screenshot") => {
                    print_screenshot_diff(obj);
                    return;
                }
                Some("diff_url") => {
                    if let Some(snap_data) = obj.get("snapshot").and_then(|v| v.as_object()) {
                        println!("{}", color::bold("Snapshot diff:"));
                        print_snapshot_diff(snap_data);
                    }
                    if let Some(ss_data) = obj.get("screenshot").and_then(|v| v.as_object()) {
                        println!("\n{}", color::bold("Screenshot diff:"));
                        print_screenshot_diff(ss_data);
                    }
                    return;
                }
                _ => {}
            }
        }
        let origin = data.get("origin").and_then(|v| v.as_str());
        // Snapshot
        if let Some(snapshot) = data.get("snapshot").and_then(|v| v.as_str()) {
            print_with_boundaries(snapshot, origin, opts);
            return;
        }
        // Title
        if let Some(title) = data.get("title").and_then(|v| v.as_str()) {
            println!("{}", title);
            return;
        }
        // Text
        if let Some(text) = data.get("text").and_then(|v| v.as_str()) {
            print_with_boundaries(text, origin, opts);
            return;
        }
        // HTML
        if let Some(html) = data.get("html").and_then(|v| v.as_str()) {
            print_with_boundaries(html, origin, opts);
            return;
        }
        // Value
        if let Some(value) = data.get("value").and_then(|v| v.as_str()) {
            println!("{}", value);
            return;
        }
        // Count
        if let Some(count) = data.get("count").and_then(|v| v.as_i64()) {
            println!("{}", count);
            return;
        }
        // Boolean results
        if let Some(visible) = data.get("visible").and_then(|v| v.as_bool()) {
            println!("{}", visible);
            return;
        }
        if let Some(enabled) = data.get("enabled").and_then(|v| v.as_bool()) {
            println!("{}", enabled);
            return;
        }
        if let Some(checked) = data.get("checked").and_then(|v| v.as_bool()) {
            println!("{}", checked);
            return;
        }
        // Eval result
        if let Some(result) = data.get("result") {
            let formatted = serde_json::to_string_pretty(result).unwrap_or_default();
            print_with_boundaries(&formatted, origin, opts);
            return;
        }

        // Tabs
        if let Some(tabs) = data.get("tabs").and_then(|v| v.as_array()) {
            for (i, tab) in tabs.iter().enumerate() {
                let title = tab
                    .get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Untitled");
                let url = tab.get("url").and_then(|v| v.as_str()).unwrap_or("");
                let active = tab.get("active").and_then(|v| v.as_bool()).unwrap_or(false);
                let marker = if active {
                    color::cyan("→")
                } else {
                    " ".to_string()
                };
                println!("{} [{}] {} - {}", marker, i, title, url);
            }
            return;
        }
        // Console logs
        if let Some(logs) = data.get("messages").and_then(|v| v.as_array()) {
            if opts.content_boundaries {
                let mut console_output = String::new();
                for log in logs {
                    let level = log.get("type").and_then(|v| v.as_str()).unwrap_or("log");
                    let text = log.get("text").and_then(|v| v.as_str()).unwrap_or("");
                    console_output.push_str(&format!(
                        "{} {}\n",
                        color::console_level_prefix(level),
                        text
                    ));
                }
                if console_output.ends_with('\n') {
                    console_output.pop();
                }
                print_with_boundaries(&console_output, origin, opts);
            } else {
                for log in logs {
                    let level = log.get("type").and_then(|v| v.as_str()).unwrap_or("log");
                    let text = log.get("text").and_then(|v| v.as_str()).unwrap_or("");
                    println!("{} {}", color::console_level_prefix(level), text);
                }
            }
            return;
        }
        // Errors
        if let Some(errors) = data.get("errors").and_then(|v| v.as_array()) {
            for err in errors {
                let msg = err.get("message").and_then(|v| v.as_str()).unwrap_or("");
                println!("{} {}", color::error_indicator(), msg);
            }
            return;
        }
        // Cookies
        if let Some(cookies) = data.get("cookies").and_then(|v| v.as_array()) {
            for cookie in cookies {
                let name = cookie.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let value = cookie.get("value").and_then(|v| v.as_str()).unwrap_or("");
                println!("{}={}", name, value);
            }
            return;
        }
        // Network requests
        if let Some(requests) = data.get("requests").and_then(|v| v.as_array()) {
            if requests.is_empty() {
                println!("No requests captured");
            } else {
                for req in requests {
                    let method = req.get("method").and_then(|v| v.as_str()).unwrap_or("GET");
                    let url = req.get("url").and_then(|v| v.as_str()).unwrap_or("");
                    let resource_type = req
                        .get("resourceType")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    println!("{} {} ({})", method, url, resource_type);
                }
            }
            return;
        }
        // Cleared (cookies or request log)
        if let Some(cleared) = data.get("cleared").and_then(|v| v.as_bool()) {
            if cleared {
                let label = match action {
                    Some("cookies_clear") => "Cookies cleared",
                    _ => "Request log cleared",
                };
                println!("{} {}", color::success_indicator(), label);
                return;
            }
        }
        // Bounding box
        if let Some(box_data) = data.get("box") {
            println!(
                "{}",
                serde_json::to_string_pretty(box_data).unwrap_or_default()
            );
            return;
        }
        // Element styles
        if let Some(elements) = data.get("elements").and_then(|v| v.as_array()) {
            for (i, el) in elements.iter().enumerate() {
                let tag = el.get("tag").and_then(|v| v.as_str()).unwrap_or("?");
                let text = el.get("text").and_then(|v| v.as_str()).unwrap_or("");
                println!("[{}] {} \"{}\"", i, tag, text);

                if let Some(box_data) = el.get("box") {
                    let w = box_data.get("width").and_then(|v| v.as_i64()).unwrap_or(0);
                    let h = box_data.get("height").and_then(|v| v.as_i64()).unwrap_or(0);
                    let x = box_data.get("x").and_then(|v| v.as_i64()).unwrap_or(0);
                    let y = box_data.get("y").and_then(|v| v.as_i64()).unwrap_or(0);
                    println!("    box: {}x{} at ({}, {})", w, h, x, y);
                }

                if let Some(styles) = el.get("styles") {
                    let font_size = styles
                        .get("fontSize")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let font_weight = styles
                        .get("fontWeight")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let font_family = styles
                        .get("fontFamily")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let color = styles.get("color").and_then(|v| v.as_str()).unwrap_or("");
                    let bg = styles
                        .get("backgroundColor")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let radius = styles
                        .get("borderRadius")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");

                    println!("    font: {} {} {}", font_size, font_weight, font_family);
                    println!("    color: {}", color);
                    println!("    background: {}", bg);
                    if radius != "0px" {
                        println!("    border-radius: {}", radius);
                    }
                }
                println!();
            }
            return;
        }
        // Closed (browser or tab)
        if data.get("closed").is_some() {
            let label = match action {
                Some("tab_close") => "Tab closed",
                _ => "Browser closed",
            };
            println!("{} {}", color::success_indicator(), label);
            return;
        }
        // Recording start (has "started" field)
        if let Some(started) = data.get("started").and_then(|v| v.as_bool()) {
            if started {
                match action {
                    Some("profiler_start") => {
                        println!("{} Profiling started", color::success_indicator());
                    }
                    _ => {
                        if let Some(path) = data.get("path").and_then(|v| v.as_str()) {
                            println!("{} Recording started: {}", color::success_indicator(), path);
                        } else {
                            println!("{} Recording started", color::success_indicator());
                        }
                    }
                }
                return;
            }
        }
        // Recording restart (has "stopped" field - from recording_restart action)
        // Note: NST browser stop also has "stopped" field, so check for "path" to distinguish
        if data.get("stopped").is_some() && data.get("path").is_some() {
            let path = data
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            if let Some(prev_path) = data.get("previousPath").and_then(|v| v.as_str()) {
                println!(
                    "{} Recording restarted: {} (previous saved to {})",
                    color::success_indicator(),
                    path,
                    prev_path
                );
            } else {
                println!("{} Recording started: {}", color::success_indicator(), path);
            }
            return;
        }
        // NST browser stop/stop-all (has "stopped" field without "path")
        if data
            .get("stopped")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            match action {
                Some("nst_browser_stop") => {
                    println!("{} Browser stopped", color::success_indicator());
                }
                Some("nst_browser_stop_all") => {
                    println!("{} All browsers stopped", color::success_indicator());
                }
                _ => {
                    // Generic stopped message for other cases
                    println!("{} Stopped", color::success_indicator());
                }
            }
            return;
        }
        // Recording stop (has "frames" field - from recording_stop action)
        if data.get("frames").is_some() {
            if let Some(path) = data.get("path").and_then(|v| v.as_str()) {
                if let Some(error) = data.get("error").and_then(|v| v.as_str()) {
                    println!(
                        "{} Recording saved to {} - {}",
                        color::warning_indicator(),
                        path,
                        error
                    );
                } else {
                    println!("{} Recording saved to {}", color::success_indicator(), path);
                }
            } else {
                println!("{} Recording stopped", color::success_indicator());
            }
            return;
        }
        // Download response (has "suggestedFilename" or "filename" field)
        if data.get("suggestedFilename").is_some() || data.get("filename").is_some() {
            if let Some(path) = data.get("path").and_then(|v| v.as_str()) {
                let filename = data
                    .get("suggestedFilename")
                    .or_else(|| data.get("filename"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if filename.is_empty() {
                    println!(
                        "{} Downloaded to {}",
                        color::success_indicator(),
                        color::green(path)
                    );
                } else {
                    println!(
                        "{} Downloaded to {} ({})",
                        color::success_indicator(),
                        color::green(path),
                        filename
                    );
                }
                return;
            }
        }
        // Trace stop without path
        if data.get("traceStopped").is_some() {
            println!("{} Trace stopped", color::success_indicator());
            return;
        }
        // Path-based operations (screenshot/pdf/trace/har/download/state/video)
        if let Some(path) = data.get("path").and_then(|v| v.as_str()) {
            match action.unwrap_or("") {
                "screenshot" => {
                    println!(
                        "{} Screenshot saved to {}",
                        color::success_indicator(),
                        color::green(path)
                    );
                    if let Some(annotations) = data.get("annotations").and_then(|v| v.as_array()) {
                        for ann in annotations {
                            let num = ann.get("number").and_then(|n| n.as_u64()).unwrap_or(0);
                            let ref_id = ann.get("ref").and_then(|r| r.as_str()).unwrap_or("");
                            let role = ann.get("role").and_then(|r| r.as_str()).unwrap_or("");
                            let name = ann.get("name").and_then(|n| n.as_str()).unwrap_or("");
                            if name.is_empty() {
                                println!(
                                    "   {} @{} {}",
                                    color::dim(&format!("[{}]", num)),
                                    ref_id,
                                    role,
                                );
                            } else {
                                println!(
                                    "   {} @{} {} {:?}",
                                    color::dim(&format!("[{}]", num)),
                                    ref_id,
                                    role,
                                    name,
                                );
                            }
                        }
                    }
                }
                "pdf" => println!(
                    "{} PDF saved to {}",
                    color::success_indicator(),
                    color::green(path)
                ),
                "trace_stop" => println!(
                    "{} Trace saved to {}",
                    color::success_indicator(),
                    color::green(path)
                ),
                "profiler_stop" => println!(
                    "{} Profile saved to {} ({} events)",
                    color::success_indicator(),
                    color::green(path),
                    data.get("eventCount").and_then(|c| c.as_u64()).unwrap_or(0)
                ),
                "har_stop" => println!(
                    "{} HAR saved to {}",
                    color::success_indicator(),
                    color::green(path)
                ),
                "download" | "waitfordownload" => println!(
                    "{} Download saved to {}",
                    color::success_indicator(),
                    color::green(path)
                ),
                "video_stop" => println!(
                    "{} Video saved to {}",
                    color::success_indicator(),
                    color::green(path)
                ),
                "state_save" => println!(
                    "{} State saved to {}",
                    color::success_indicator(),
                    color::green(path)
                ),
                "state_load" => {
                    if let Some(note) = data.get("note").and_then(|v| v.as_str()) {
                        println!("{}", note);
                    }
                    println!(
                        "{} State path set to {}",
                        color::success_indicator(),
                        color::green(path)
                    );
                }
                // video_start and other commands that provide a path with a note
                "video_start" => {
                    if let Some(note) = data.get("note").and_then(|v| v.as_str()) {
                        println!("{}", note);
                    }
                    println!("Path: {}", path);
                }
                _ => println!(
                    "{} Saved to {}",
                    color::success_indicator(),
                    color::green(path)
                ),
            }
            return;
        }

        // State list
        if let Some(files) = data.get("files").and_then(|v| v.as_array()) {
            if let Some(dir) = data.get("directory").and_then(|v| v.as_str()) {
                println!("{}", color::bold(&format!("Saved states in {}", dir)));
            }
            if files.is_empty() {
                println!("{}", color::dim("  No state files found"));
            } else {
                for file in files {
                    let filename = file.get("filename").and_then(|v| v.as_str()).unwrap_or("");
                    let size = file.get("size").and_then(|v| v.as_i64()).unwrap_or(0);
                    let modified = file.get("modified").and_then(|v| v.as_str()).unwrap_or("");
                    let encrypted = file
                        .get("encrypted")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    let size_str = if size > 1024 {
                        format!("{:.1}KB", size as f64 / 1024.0)
                    } else {
                        format!("{}B", size)
                    };
                    let date_str = modified.split('T').next().unwrap_or(modified);
                    let enc_str = if encrypted { " [encrypted]" } else { "" };
                    println!(
                        "  {} {}",
                        filename,
                        color::dim(&format!("({}, {}){}", size_str, date_str, enc_str))
                    );
                }
            }
            return;
        }

        // State rename
        if let Some(true) = data.get("renamed").and_then(|v| v.as_bool()) {
            let old_name = data.get("oldName").and_then(|v| v.as_str()).unwrap_or("");
            let new_name = data.get("newName").and_then(|v| v.as_str()).unwrap_or("");
            println!(
                "{} Renamed {} -> {}",
                color::success_indicator(),
                old_name,
                new_name
            );
            return;
        }

        // State clear
        if let Some(cleared) = data.get("cleared").and_then(|v| v.as_i64()) {
            println!(
                "{} Cleared {} state file(s)",
                color::success_indicator(),
                cleared
            );
            return;
        }

        // State show summary
        if let Some(summary) = data.get("summary") {
            let cookies = summary.get("cookies").and_then(|v| v.as_i64()).unwrap_or(0);
            let origins = summary.get("origins").and_then(|v| v.as_i64()).unwrap_or(0);
            let encrypted = data
                .get("encrypted")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let enc_str = if encrypted { " (encrypted)" } else { "" };
            println!("State file summary{}:", enc_str);
            println!("  Cookies: {}", cookies);
            println!("  Origins with localStorage: {}", origins);
            return;
        }

        // State clean
        if let Some(cleaned) = data.get("cleaned").and_then(|v| v.as_i64()) {
            println!(
                "{} Cleaned {} old state file(s)",
                color::success_indicator(),
                cleaned
            );
            return;
        }

        // Informational note
        if let Some(note) = data.get("note").and_then(|v| v.as_str()) {
            println!("{}", note);
            return;
        }
        // Profile list (NST browser profiles or auth profiles)
        if let Some(profiles) = data.get("profiles").and_then(|v| v.as_array()) {
            if profiles.is_empty() {
                // Check if this is NST profiles or auth profiles by looking at action or first profile structure
                let is_nst = profiles.is_empty()
                    || profiles
                        .first()
                        .and_then(|p| p.as_object())
                        .map(|p| p.contains_key("profileId"))
                        .unwrap_or(false);

                if is_nst {
                    println!("{}", color::dim("No profiles found"));
                } else {
                    println!("{}", color::dim("No auth profiles saved"));
                }
            } else {
                // Check if these are NST profiles (have profileId) or auth profiles (have username/url)
                let first_profile = profiles.first().and_then(|p| p.as_object());
                let is_nst = first_profile
                    .map(|p| p.contains_key("profileId"))
                    .unwrap_or(false);

                if is_nst {
                    // NST browser profiles
                    println!(
                        "{}",
                        color::bold(&format!("Profiles ({}):", profiles.len()))
                    );
                    for p in profiles {
                        let name = p
                            .get("name")
                            .and_then(|v| v.as_str())
                            .unwrap_or("(unnamed)");
                        let profile_id = p.get("profileId").and_then(|v| v.as_str()).unwrap_or("");
                        let platform = p.get("platform").and_then(|v| v.as_i64()).unwrap_or(0);
                        let platform_name = match platform {
                            1 => "macOS",
                            2 => "Windows",
                            3 => "Linux",
                            _ => "Unknown",
                        };

                        // Show proxy IP if available
                        let proxy_info = p
                            .get("proxyResult")
                            .and_then(|pr| pr.as_object())
                            .and_then(|pr| pr.get("ip"))
                            .and_then(|ip| ip.as_str())
                            .map(|ip| format!(" [{}]", color::cyan(ip)))
                            .unwrap_or_default();

                        // Show group name if available
                        let group_info = p
                            .get("groupName")
                            .and_then(|g| g.as_str())
                            .filter(|g| !g.is_empty())
                            .map(|g| format!(" {}", color::dim(&format!("({})", g))))
                            .unwrap_or_default();

                        // Show tags if available
                        let tags_info = p
                            .get("tags")
                            .and_then(|t| t.as_array())
                            .filter(|tags| !tags.is_empty())
                            .map(|tags| {
                                let tag_names: Vec<String> = tags
                                    .iter()
                                    .filter_map(|t| t.get("name").and_then(|n| n.as_str()))
                                    .map(|n| n.to_string())
                                    .collect();
                                if !tag_names.is_empty() {
                                    format!(
                                        " {}",
                                        color::dim(&format!("[{}]", tag_names.join(", ")))
                                    )
                                } else {
                                    String::new()
                                }
                            })
                            .unwrap_or_default();

                        println!(
                            "  {} {}{}{}{}",
                            color::green(name),
                            color::dim(&format!(
                                "({}, {})",
                                profile_id.chars().take(8).collect::<String>(),
                                platform_name
                            )),
                            proxy_info,
                            group_info,
                            tags_info
                        );
                    }
                } else {
                    // Auth profiles (legacy)
                    println!("{}", color::bold("Auth profiles:"));
                    for p in profiles {
                        let name = p.get("name").and_then(|v| v.as_str()).unwrap_or("");
                        let url = p.get("url").and_then(|v| v.as_str()).unwrap_or("");
                        let user = p.get("username").and_then(|v| v.as_str()).unwrap_or("");
                        println!(
                            "  {} {} {}",
                            color::green(name),
                            color::dim(user),
                            color::dim(url)
                        );
                    }
                }
            }
            return;
        }

        // Browser list (NST running browser instances)
        if let Some(browsers) = data.get("browsers").and_then(|v| v.as_array()) {
            if browsers.is_empty() {
                println!("{}", color::dim("No browsers running"));
            } else {
                println!(
                    "{}",
                    color::bold(&format!("Running browsers ({}):", browsers.len()))
                );
                for b in browsers {
                    let name = b
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("(unnamed)");
                    let profile_id = b.get("profileId").and_then(|v| v.as_str()).unwrap_or("");
                    let port = b
                        .get("remoteDebuggingPort")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    let platform = b.get("platform").and_then(|v| v.as_i64()).unwrap_or(0);
                    let platform_name = match platform {
                        1 => "macOS",
                        2 => "Windows",
                        3 => "Linux",
                        _ => "Unknown",
                    };

                    // Show kernel version if available
                    let kernel_info = b
                        .get("kernel")
                        .and_then(|k| k.as_str())
                        .filter(|k| !k.is_empty())
                        .map(|k| format!(" {}", color::dim(&format!("kernel:{}", k))))
                        .unwrap_or_default();

                    // Show running status
                    let running = b.get("running").and_then(|r| r.as_bool()).unwrap_or(true);
                    let status_info = if running {
                        format!(" {}", color::green("●"))
                    } else {
                        format!(" {}", color::dim("○"))
                    };

                    println!(
                        "  {}{} {} {}{}",
                        color::green(name),
                        status_info,
                        color::dim(&format!(
                            "({}, {})",
                            profile_id.chars().take(8).collect::<String>(),
                            platform_name
                        )),
                        color::dim(&format!("port {}", port)),
                        kernel_info
                    );
                }
            }
            return;
        }

        // NST Profile show (Nstbrowser profile, not auth profile)
        if let Some(profile) = data.get("profile").and_then(|v| v.as_object()) {
            // Check if this is an NST profile (has profileId) or auth profile (has username/url)
            if profile.contains_key("profileId") {
                // This is an NST browser profile
                let name = profile
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("(unnamed)");
                let profile_id = profile
                    .get("profileId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let created = profile
                    .get("createdAt")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let last_launched = profile.get("lastLaunchedAt").and_then(|v| v.as_str());

                println!("{} {}", color::bold("Profile:"), color::green(name));
                println!("  ID: {}", color::dim(profile_id));

                // Show group name if available
                if let Some(group_name) = profile.get("groupName").and_then(|v| v.as_str()) {
                    if !group_name.is_empty() {
                        println!("  Group: {}", color::dim(group_name));
                    }
                }

                // Show tags if available
                if let Some(tags) = profile.get("tags").and_then(|v| v.as_array()) {
                    if !tags.is_empty() {
                        let tag_names: Vec<String> = tags
                            .iter()
                            .filter_map(|t| t.get("name").and_then(|n| n.as_str()))
                            .map(|n| n.to_string())
                            .collect();
                        if !tag_names.is_empty() {
                            println!("  Tags: {}", color::dim(&tag_names.join(", ")));
                        }
                    }
                }

                println!("  Created: {}", color::dim(created));
                if let Some(ll) = last_launched {
                    println!("  Last launched: {}", color::dim(ll));
                }

                // Show proxy info if available
                if let Some(proxy_result) = profile.get("proxyResult").and_then(|v| v.as_object()) {
                    if let Some(ip) = proxy_result.get("ip").and_then(|v| v.as_str()) {
                        let country = proxy_result
                            .get("country")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        let city = proxy_result
                            .get("city")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        let location = if !city.is_empty() && !country.is_empty() {
                            format!("{}, {}", city, country)
                        } else if !country.is_empty() {
                            country.to_string()
                        } else {
                            String::new()
                        };

                        if !location.is_empty() {
                            println!("  Proxy: {} ({})", color::cyan(ip), color::dim(&location));
                        } else {
                            println!("  Proxy: {}", color::cyan(ip));
                        }

                        // Show proxy type if available
                        if let Some(protocol) =
                            proxy_result.get("protocol").and_then(|v| v.as_str())
                        {
                            if !protocol.is_empty() {
                                println!("  Proxy type: {}", color::dim(protocol));
                            }
                        }
                    }
                } else if let Some(proxy_config) =
                    profile.get("proxyConfig").and_then(|v| v.as_object())
                {
                    // Show proxy config if proxyResult is not available
                    if let Some(proxy_type) = proxy_config.get("proxyType").and_then(|v| v.as_str())
                    {
                        println!("  Proxy type: {}", color::dim(proxy_type));
                    }
                }

                // Show platform info
                if let Some(platform) = profile.get("platform").and_then(|v| v.as_i64()) {
                    let platform_name = match platform {
                        1 => "macOS",
                        2 => "Windows",
                        3 => "Linux",
                        _ => "Unknown",
                    };
                    if let Some(platform_version) =
                        profile.get("platformVersion").and_then(|v| v.as_str())
                    {
                        println!(
                            "  Platform: {} {}",
                            platform_name,
                            color::dim(platform_version)
                        );
                    } else {
                        println!("  Platform: {}", platform_name);
                    }
                }

                // Show kernel version if available
                if let Some(kernel) = profile.get("kernel").and_then(|v| v.as_str()) {
                    if !kernel.is_empty() {
                        println!("  Kernel: {}", color::dim(kernel));
                    }
                }

                return;
            } else {
                // This is an auth profile (legacy format)
                let name = profile.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let url = profile.get("url").and_then(|v| v.as_str()).unwrap_or("");
                let user = profile
                    .get("username")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let created = profile
                    .get("createdAt")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let last_login = profile.get("lastLoginAt").and_then(|v| v.as_str());

                println!("{} {}", color::bold("Auth Profile:"), color::green(name));
                if !url.is_empty() {
                    println!("  URL: {}", color::dim(url));
                }
                if !user.is_empty() {
                    println!("  Username: {}", color::dim(user));
                }
                println!("  Created: {}", color::dim(created));
                if let Some(ll) = last_login {
                    println!("  Last login: {}", color::dim(ll));
                }
                return;
            }
        }

        // Auth save/update/login/delete
        if data.get("saved").and_then(|v| v.as_bool()).unwrap_or(false) {
            let name = data.get("name").and_then(|v| v.as_str()).unwrap_or("");
            println!(
                "{} Auth profile '{}' saved",
                color::success_indicator(),
                name
            );
            return;
        }
        if data
            .get("updated")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
            && !data.get("saved").and_then(|v| v.as_bool()).unwrap_or(false)
        {
            let name = data.get("name").and_then(|v| v.as_str()).unwrap_or("");
            println!(
                "{} Auth profile '{}' updated",
                color::success_indicator(),
                name
            );
            return;
        }
        if data
            .get("loggedIn")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            let name = data.get("name").and_then(|v| v.as_str()).unwrap_or("");
            if let Some(title) = data.get("title").and_then(|v| v.as_str()) {
                println!(
                    "{} Logged in as '{}' - {}",
                    color::success_indicator(),
                    name,
                    title
                );
            } else {
                println!("{} Logged in as '{}'", color::success_indicator(), name);
            }
            return;
        }
        if data
            .get("deleted")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            if let Some(name) = data.get("name").and_then(|v| v.as_str()) {
                println!(
                    "{} Auth profile '{}' deleted",
                    color::success_indicator(),
                    name
                );
                return;
            }
        }

        // Confirmation required (for orchestrator use)
        if data
            .get("confirmation_required")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            let category = data.get("category").and_then(|v| v.as_str()).unwrap_or("");
            let description = data
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let cid = data
                .get("confirmation_id")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            println!("Confirmation required:");
            println!("  {}: {}", category, description);
            println!("  Run: nstbrowser-ai-agent confirm {}", cid);
            println!("  Or:  nstbrowser-ai-agent deny {}", cid);
            return;
        }
        if data
            .get("confirmed")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            println!("{} Action confirmed", color::success_indicator());
            return;
        }
        if data
            .get("denied")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            println!("{} Action denied", color::success_indicator());
            return;
        }

        // Default success
        println!("{} Done", color::success_indicator());
    }
}

/// Print command-specific help. Returns true if help was printed, false if command unknown.
pub fn print_command_help(command: &str) -> bool {
    let help = match command {
        // === Navigation ===
        "open" | "goto" | "navigate" => {
            r##"
nstbrowser-ai-agent open - Navigate to a URL

Usage: nstbrowser-ai-agent open <url>

Navigates the browser to the specified URL. If no protocol is provided,
https:// is automatically prepended.

Aliases: goto, navigate

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session
  --headers <json>     Set HTTP headers (scoped to this origin)
  --headed             Show browser window

Examples:
  nstbrowser-ai-agent open example.com
  nstbrowser-ai-agent open https://github.com
  nstbrowser-ai-agent open localhost:3000
  nstbrowser-ai-agent open api.example.com --headers '{"Authorization": "Bearer token"}'
    # ^ Headers only sent to api.example.com, not other domains
"##
        }
        "back" => {
            r##"
nstbrowser-ai-agent back - Navigate back in history

Usage: nstbrowser-ai-agent back

Goes back one page in the browser history, equivalent to clicking
the browser's back button.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent back
"##
        }
        "forward" => {
            r##"
nstbrowser-ai-agent forward - Navigate forward in history

Usage: nstbrowser-ai-agent forward

Goes forward one page in the browser history, equivalent to clicking
the browser's forward button.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent forward
"##
        }
        "reload" => {
            r##"
nstbrowser-ai-agent reload - Reload the current page

Usage: nstbrowser-ai-agent reload

Reloads the current page, equivalent to pressing F5 or clicking
the browser's reload button.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent reload
"##
        }

        // === Core Actions ===
        "click" => {
            r##"
nstbrowser-ai-agent click - Click an element

Usage: nstbrowser-ai-agent click <selector> [--new-tab]

Clicks on the specified element. The selector can be a CSS selector,
XPath, or an element reference from snapshot (e.g., @e1).

Options:
  --new-tab            Open link in a new tab instead of navigating current tab
                       (only works on elements with href attribute)

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent click "#submit-button"
  nstbrowser-ai-agent click @e1
  nstbrowser-ai-agent click "button.primary"
  nstbrowser-ai-agent click "//button[@type='submit']"
  nstbrowser-ai-agent click @e3 --new-tab
"##
        }
        "dblclick" => {
            r##"
nstbrowser-ai-agent dblclick - Double-click an element

Usage: nstbrowser-ai-agent dblclick <selector>

Double-clicks on the specified element. Useful for text selection
or triggering double-click handlers.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent dblclick "#editable-text"
  nstbrowser-ai-agent dblclick @e5
"##
        }
        "fill" => {
            r##"
nstbrowser-ai-agent fill - Clear and fill an input field

Usage: nstbrowser-ai-agent fill <selector> <text>

Clears the input field and fills it with the specified text.
This replaces any existing content in the field.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent fill "#email" "user@example.com"
  nstbrowser-ai-agent fill @e3 "Hello World"
  nstbrowser-ai-agent fill "input[name='search']" "query"
"##
        }
        "type" => {
            r##"
nstbrowser-ai-agent type - Type text into an element

Usage: nstbrowser-ai-agent type <selector> <text>

Types text into the specified element character by character.
Unlike fill, this does not clear existing content first.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent type "#search" "hello"
  nstbrowser-ai-agent type @e2 "additional text"

See Also:
  For typing into contenteditable editors (Lexical, ProseMirror, etc.)
  without a selector, use 'keyboard type' instead:
    nstbrowser-ai-agent keyboard type "# My Heading"
"##
        }
        "hover" => {
            r##"
nstbrowser-ai-agent hover - Hover over an element

Usage: nstbrowser-ai-agent hover <selector>

Moves the mouse to hover over the specified element. Useful for
triggering hover states or dropdown menus.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent hover "#dropdown-trigger"
  nstbrowser-ai-agent hover @e4
"##
        }
        "focus" => {
            r##"
nstbrowser-ai-agent focus - Focus an element

Usage: nstbrowser-ai-agent focus <selector>

Sets keyboard focus to the specified element.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent focus "#input-field"
  nstbrowser-ai-agent focus @e2
"##
        }
        "check" => {
            r##"
nstbrowser-ai-agent check - Check a checkbox

Usage: nstbrowser-ai-agent check <selector>

Checks a checkbox element. If already checked, no action is taken.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent check "#terms-checkbox"
  nstbrowser-ai-agent check @e7
"##
        }
        "uncheck" => {
            r##"
nstbrowser-ai-agent uncheck - Uncheck a checkbox

Usage: nstbrowser-ai-agent uncheck <selector>

Unchecks a checkbox element. If already unchecked, no action is taken.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent uncheck "#newsletter-opt-in"
  nstbrowser-ai-agent uncheck @e8
"##
        }
        "select" => {
            r##"
nstbrowser-ai-agent select - Select a dropdown option

Usage: nstbrowser-ai-agent select <selector> <value...>

Selects one or more options in a <select> dropdown by value.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent select "#country" "US"
  nstbrowser-ai-agent select @e5 "option2"
  nstbrowser-ai-agent select "#menu" "opt1" "opt2" "opt3"
"##
        }
        "drag" => {
            r##"
nstbrowser-ai-agent drag - Drag and drop

Usage: nstbrowser-ai-agent drag <source> <target>

Drags an element from source to target location.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent drag "#draggable" "#drop-zone"
  nstbrowser-ai-agent drag @e1 @e2
"##
        }
        "upload" => {
            r##"
nstbrowser-ai-agent upload - Upload files

Usage: nstbrowser-ai-agent upload <selector> <files...>

Uploads one or more files to a file input element.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent upload "#file-input" ./document.pdf
  nstbrowser-ai-agent upload @e3 ./image1.png ./image2.png
"##
        }
        "download" => {
            r##"
nstbrowser-ai-agent download - Download a file by clicking an element

Usage: nstbrowser-ai-agent download <selector> <path>

Clicks an element that triggers a download and saves the file to the specified path.

Arguments:
  selector             Element to click (CSS selector or @ref)
  path                 Path where the downloaded file will be saved

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent download "#download-btn" ./file.pdf
  nstbrowser-ai-agent download @e5 ./report.xlsx
  nstbrowser-ai-agent download "a[href$='.zip']" ./archive.zip
"##
        }

        // === Keyboard ===
        "press" | "key" => {
            r##"
nstbrowser-ai-agent press - Press a key or key combination

Usage: nstbrowser-ai-agent press <key>

Presses a key or key combination. Supports special keys and modifiers.

Aliases: key

Special Keys:
  Enter, Tab, Escape, Backspace, Delete, Space
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight
  Home, End, PageUp, PageDown
  F1-F12

Modifiers (combine with +):
  Control, Alt, Shift, Meta

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent press Enter
  nstbrowser-ai-agent press Tab
  nstbrowser-ai-agent press Control+a
  nstbrowser-ai-agent press Control+Shift+s
  nstbrowser-ai-agent press Escape
"##
        }
        "keydown" => {
            r##"
nstbrowser-ai-agent keydown - Press a key down (without release)

Usage: nstbrowser-ai-agent keydown <key>

Presses a key down without releasing it. Use keyup to release.
Useful for holding modifier keys.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent keydown Shift
  nstbrowser-ai-agent keydown Control
"##
        }
        "keyup" => {
            r##"
nstbrowser-ai-agent keyup - Release a key

Usage: nstbrowser-ai-agent keyup <key>

Releases a key that was pressed with keydown.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent keyup Shift
  nstbrowser-ai-agent keyup Control
"##
        }
        "keyboard" => {
            r##"
nstbrowser-ai-agent keyboard - Raw keyboard input (no selector needed)

Usage: nstbrowser-ai-agent keyboard <subcommand> <text>

Sends keyboard input to whatever element currently has focus.
Unlike 'type' which requires a selector, 'keyboard' operates on
the current focus — essential for contenteditable editors like
Lexical, ProseMirror, CodeMirror, and Monaco.

Subcommands:
  type <text>          Type text character-by-character with real
                       key events (keydown, keypress, keyup per char)
  inserttext <text>    Insert text without key events (like paste)

Note: For key combos (Enter, Control+a), use the 'press' command
directly — it already operates on the current focus.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent keyboard type "Hello, World!"
  nstbrowser-ai-agent keyboard type "# My Heading"
  nstbrowser-ai-agent keyboard inserttext "pasted content"

Use Cases:
  # Type into a Lexical/ProseMirror contenteditable editor:
  nstbrowser-ai-agent click "[contenteditable]"
  nstbrowser-ai-agent keyboard type "# My Heading"
  nstbrowser-ai-agent press Enter
  nstbrowser-ai-agent keyboard type "Some paragraph text"
"##
        }

        // === Scroll ===
        "scroll" => {
            r##"
nstbrowser-ai-agent scroll - Scroll the page

Usage: nstbrowser-ai-agent scroll [direction] [amount] [options]

Scrolls the page or a specific element in the specified direction.

Arguments:
  direction            up, down, left, right (default: down)
  amount               Pixels to scroll (default: 300)

Options:
  -s, --selector <sel> CSS selector for a scrollable container

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent scroll
  nstbrowser-ai-agent scroll down 500
  nstbrowser-ai-agent scroll up 200
  nstbrowser-ai-agent scroll left 100
  nstbrowser-ai-agent scroll down 500 --selector "div.scroll-container"
"##
        }
        "scrollintoview" | "scrollinto" => {
            r##"
nstbrowser-ai-agent scrollintoview - Scroll element into view

Usage: nstbrowser-ai-agent scrollintoview <selector>

Scrolls the page until the specified element is visible in the viewport.

Aliases: scrollinto

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent scrollintoview "#footer"
  nstbrowser-ai-agent scrollintoview @e15
"##
        }

        // === Wait ===
        "wait" => {
            r##"
nstbrowser-ai-agent wait - Wait for condition

Usage: nstbrowser-ai-agent wait <selector|ms|option>

Waits for an element to appear, a timeout, or other conditions.

Modes:
  <selector>           Wait for element to appear
  <ms>                 Wait for specified milliseconds
  --url <pattern>      Wait for URL to match pattern
  --load <state>       Wait for load state (load, domcontentloaded, networkidle)
  --fn <expression>    Wait for JavaScript expression to be truthy
  --text <text>        Wait for text to appear on page
  --download [path]    Wait for a download to complete (optionally save to path)

Download Options (with --download):
  --timeout <ms>       Timeout in milliseconds for download to start

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent wait "#loading-spinner"
  nstbrowser-ai-agent wait 2000
  nstbrowser-ai-agent wait --url "**/dashboard"
  nstbrowser-ai-agent wait --load networkidle
  nstbrowser-ai-agent wait --fn "window.appReady === true"
  nstbrowser-ai-agent wait --text "Welcome back"
  nstbrowser-ai-agent wait --download ./file.pdf
  nstbrowser-ai-agent wait --download ./report.xlsx --timeout 30000
"##
        }

        // === Screenshot/PDF ===
        "screenshot" => {
            r##"
nstbrowser-ai-agent screenshot - Take a screenshot

Usage: nstbrowser-ai-agent screenshot [path]

Captures a screenshot of the current page. If no path is provided,
saves to a temporary directory with a generated filename.

Options:
  --full, -f           Capture full page (not just viewport)
  --annotate           Overlay numbered labels on interactive elements.
                       Each label [N] corresponds to ref @eN from snapshot.
                       Prints a legend mapping labels to element roles/names.
                       With --json, annotations are included in the response.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent screenshot
  nstbrowser-ai-agent screenshot ./screenshot.png
  nstbrowser-ai-agent screenshot --full ./full-page.png
  nstbrowser-ai-agent screenshot --annotate              # Labeled screenshot + legend
  nstbrowser-ai-agent screenshot --annotate ./page.png   # Save annotated screenshot
  nstbrowser-ai-agent screenshot --annotate --json       # JSON output with annotations
"##
        }
        "pdf" => {
            r##"
nstbrowser-ai-agent pdf - Save page as PDF

Usage: nstbrowser-ai-agent pdf <path>

Saves the current page as a PDF file.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent pdf ./page.pdf
  nstbrowser-ai-agent pdf ~/Documents/report.pdf
"##
        }

        // === Snapshot ===
        "snapshot" => {
            r##"
nstbrowser-ai-agent snapshot - Get accessibility tree snapshot

Usage: nstbrowser-ai-agent snapshot [options]

Returns an accessibility tree representation of the page with element
references (like @e1, @e2) that can be used in subsequent commands.
Designed for AI agents to understand page structure.

Options:
  -i, --interactive    Only include interactive elements
  -C, --cursor         Include cursor-interactive elements (cursor:pointer, onclick, tabindex)
  -c, --compact        Remove empty structural elements
  -d, --depth <n>      Limit tree depth
  -s, --selector <sel> Scope snapshot to CSS selector

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent snapshot
  nstbrowser-ai-agent snapshot -i
  nstbrowser-ai-agent snapshot -i -C         # Interactive + cursor-interactive elements
  nstbrowser-ai-agent snapshot --compact --depth 5
  nstbrowser-ai-agent snapshot -s "#main-content"
"##
        }

        // === Eval ===
        "eval" => {
            r##"
nstbrowser-ai-agent eval - Execute JavaScript

Usage: nstbrowser-ai-agent eval [options] <script>

Executes JavaScript code in the browser context and returns the result.

Options:
  -b, --base64         Decode script from base64 (avoids shell escaping issues)
  --stdin              Read script from stdin (useful for heredocs/multiline)

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent eval "document.title"
  nstbrowser-ai-agent eval "window.location.href"
  nstbrowser-ai-agent eval "document.querySelectorAll('a').length"
  nstbrowser-ai-agent eval -b "ZG9jdW1lbnQudGl0bGU="

  # Read from stdin with heredoc
  cat <<'EOF' | nstbrowser-ai-agent eval --stdin
  const links = document.querySelectorAll('a');
  links.length;
  EOF
"##
        }

        // === Close ===
        "close" | "quit" | "exit" => {
            r##"
nstbrowser-ai-agent close - Close the browser

Usage: nstbrowser-ai-agent close

Closes the browser instance for the current session.

Aliases: quit, exit

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent close
  nstbrowser-ai-agent close --session mysession
"##
        }

        // === Get ===
        "get" => {
            r##"
nstbrowser-ai-agent get - Retrieve information from elements or page

Usage: nstbrowser-ai-agent get <subcommand> [args]

Retrieves various types of information from elements or the page.

Subcommands:
  text <selector>            Get text content of element
  html <selector>            Get inner HTML of element
  value <selector>           Get value of input element
  attr <selector> <name>     Get attribute value
  title                      Get page title
  url                        Get current URL
  count <selector>           Count matching elements
  box <selector>             Get bounding box (x, y, width, height)
  styles <selector>          Get computed styles of elements

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent get text @e1
  nstbrowser-ai-agent get html "#content"
  nstbrowser-ai-agent get value "#email-input"
  nstbrowser-ai-agent get attr "#link" href
  nstbrowser-ai-agent get title
  nstbrowser-ai-agent get url
  nstbrowser-ai-agent get count "li.item"
  nstbrowser-ai-agent get box "#header"
  nstbrowser-ai-agent get styles "button"
  nstbrowser-ai-agent get styles @e1
"##
        }

        // === Is ===
        "is" => {
            r##"
nstbrowser-ai-agent is - Check element state

Usage: nstbrowser-ai-agent is <subcommand> <selector>

Checks the state of an element and returns true/false.

Subcommands:
  visible <selector>   Check if element is visible
  enabled <selector>   Check if element is enabled (not disabled)
  checked <selector>   Check if checkbox/radio is checked

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent is visible "#modal"
  nstbrowser-ai-agent is enabled "#submit-btn"
  nstbrowser-ai-agent is checked "#agree-checkbox"
"##
        }

        // === Find ===
        "find" => {
            r##"
nstbrowser-ai-agent find - Find and interact with elements by locator

Usage: nstbrowser-ai-agent find <locator> <value> [action] [text]

Finds elements using semantic locators and optionally performs an action.

Locators:
  role <role>              Find by ARIA role (--name <n>, --exact)
  text <text>              Find by text content (--exact)
  label <label>            Find by associated label (--exact)
  placeholder <text>       Find by placeholder text (--exact)
  alt <text>               Find by alt text (--exact)
  title <text>             Find by title attribute (--exact)
  testid <id>              Find by data-testid attribute
  first <selector>         First matching element
  last <selector>          Last matching element
  nth <index> <selector>   Nth matching element (0-based)

Actions (default: click):
  click, fill, type, hover, focus, check, uncheck

Options:
  --name <name>        Filter role by accessible name
  --exact              Require exact text match

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent find role button click --name Submit
  nstbrowser-ai-agent find text "Sign In" click
  nstbrowser-ai-agent find label "Email" fill "user@example.com"
  nstbrowser-ai-agent find placeholder "Search..." type "query"
  nstbrowser-ai-agent find testid "login-form" click
  nstbrowser-ai-agent find first "li.item" click
  nstbrowser-ai-agent find nth 2 ".card" hover
"##
        }

        // === Mouse ===
        "mouse" => {
            r##"
nstbrowser-ai-agent mouse - Low-level mouse operations

Usage: nstbrowser-ai-agent mouse <subcommand> [args]

Performs low-level mouse operations for precise control.

Subcommands:
  move <x> <y>         Move mouse to coordinates
  down [button]        Press mouse button (left, right, middle)
  up [button]          Release mouse button
  wheel <dy> [dx]      Scroll mouse wheel

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent mouse move 100 200
  nstbrowser-ai-agent mouse down
  nstbrowser-ai-agent mouse up
  nstbrowser-ai-agent mouse down right
  nstbrowser-ai-agent mouse wheel 100
  nstbrowser-ai-agent mouse wheel -50 0
"##
        }

        // === Set ===
        "set" => {
            r##"
nstbrowser-ai-agent set - Configure browser settings

Usage: nstbrowser-ai-agent set <setting> [args]

Configures various browser settings and emulation options.

Settings:
  viewport <w> <h>           Set viewport size
  device <name>              Emulate device (e.g., "iPhone 12")
  geo <lat> <lng>            Set geolocation
  offline [on|off]           Toggle offline mode
  headers <json>             Set extra HTTP headers
  credentials <user> <pass>  Set HTTP authentication
  media [dark|light]         Set color scheme preference
        [reduced-motion]     Enable reduced motion

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent set viewport 1920 1080
  nstbrowser-ai-agent set device "iPhone 12"
  nstbrowser-ai-agent set geo 37.7749 -122.4194
  nstbrowser-ai-agent set offline on
  nstbrowser-ai-agent set headers '{"X-Custom": "value"}'
  nstbrowser-ai-agent set credentials admin secret123
  nstbrowser-ai-agent set media dark
  nstbrowser-ai-agent set media light reduced-motion
"##
        }

        // === Network ===
        "network" => {
            r##"
nstbrowser-ai-agent network - Network interception and monitoring

Usage: nstbrowser-ai-agent network <subcommand> [args]

Intercept, mock, or monitor network requests.

Subcommands:
  route <url> [options]      Intercept requests matching URL pattern
    --abort                  Abort matching requests
    --body <json>            Respond with custom body
  unroute [url]              Remove route (all if no URL)
  requests [options]         List captured requests
    --clear                  Clear request log
    --filter <pattern>       Filter by URL pattern

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent network route "**/api/*" --abort
  nstbrowser-ai-agent network route "**/data.json" --body '{"mock": true}'
  nstbrowser-ai-agent network unroute
  nstbrowser-ai-agent network requests
  nstbrowser-ai-agent network requests --filter "api"
  nstbrowser-ai-agent network requests --clear
"##
        }

        // === Storage ===
        "storage" => {
            r##"
nstbrowser-ai-agent storage - Manage web storage

Usage: nstbrowser-ai-agent storage <type> [operation] [key] [value]

Manage localStorage and sessionStorage.

Types:
  local                localStorage
  session              sessionStorage

Operations:
  get [key]            Get all storage or specific key
  set <key> <value>    Set a key-value pair
  clear                Clear all storage

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent storage local
  nstbrowser-ai-agent storage local get authToken
  nstbrowser-ai-agent storage local set theme "dark"
  nstbrowser-ai-agent storage local clear
  nstbrowser-ai-agent storage session get userId
"##
        }

        // === Cookies ===
        "cookies" => {
            r##"
nstbrowser-ai-agent cookies - Manage browser cookies

Usage: nstbrowser-ai-agent cookies [operation] [args]

Manage browser cookies for the current context.

Operations:
  get                                Get all cookies (default)
  set <name> <value> [options]       Set a cookie with optional properties
  clear                              Clear all cookies

Cookie Set Options:
  --url <url>                        URL for the cookie (allows setting before page load)
  --domain <domain>                  Cookie domain (e.g., ".example.com")
  --path <path>                      Cookie path (e.g., "/api")
  --httpOnly                         Set HttpOnly flag (prevents JavaScript access)
  --secure                           Set Secure flag (HTTPS only)
  --sameSite <Strict|Lax|None>       SameSite policy
  --expires <timestamp>              Expiration time (Unix timestamp in seconds)

Note: If --url, --domain, and --path are all omitted, the cookie will be set
for the current page URL.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  # Simple cookie for current page
  nstbrowser-ai-agent cookies set session_id "abc123"

  # Set cookie for a URL before loading it (useful for authentication)
  nstbrowser-ai-agent cookies set session_id "abc123" --url https://app.example.com

  # Set secure, httpOnly cookie with domain and path
  nstbrowser-ai-agent cookies set auth_token "xyz789" --domain example.com --path /api --httpOnly --secure

  # Set cookie with SameSite policy
  nstbrowser-ai-agent cookies set tracking_consent "yes" --sameSite Strict

  # Set cookie with expiration (Unix timestamp)
  nstbrowser-ai-agent cookies set temp_token "temp123" --expires 1735689600

  # Get all cookies
  nstbrowser-ai-agent cookies

  # Clear all cookies
  nstbrowser-ai-agent cookies clear
"##
        }

        // === Tabs ===
        "tab" => {
            r##"
nstbrowser-ai-agent tab - Manage browser tabs

Usage: nstbrowser-ai-agent tab [operation] [args]

Manage browser tabs in the current window.

Operations:
  list                 List all tabs (default)
  new [url]            Open new tab
  close [index]        Close tab (current if no index)
  <index>              Switch to tab by index

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent tab
  nstbrowser-ai-agent tab list
  nstbrowser-ai-agent tab new
  nstbrowser-ai-agent tab new https://example.com
  nstbrowser-ai-agent tab 2
  nstbrowser-ai-agent tab close
  nstbrowser-ai-agent tab close 1
"##
        }

        // === Window ===
        "window" => {
            r##"
nstbrowser-ai-agent window - Manage browser windows

Usage: nstbrowser-ai-agent window <operation>

Manage browser windows.

Operations:
  new                  Open new browser window

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent window new
"##
        }

        // === Frame ===
        "frame" => {
            r##"
nstbrowser-ai-agent frame - Switch frame context

Usage: nstbrowser-ai-agent frame <selector|main>

Switch to an iframe or back to the main frame.

Arguments:
  <selector>           CSS selector for iframe
  main                 Switch back to main frame

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent frame "#embed-iframe"
  nstbrowser-ai-agent frame "iframe[name='content']"
  nstbrowser-ai-agent frame main
"##
        }

        // === Auth ===
        "auth" => {
            r##"
nstbrowser-ai-agent auth - Manage authentication profiles

Usage: nstbrowser-ai-agent auth <subcommand> [args]

Subcommands:
  save <name>              Save credentials for a login profile
  login <name>             Login using saved credentials
  list                     List saved profiles (names and URLs only)
  show <name>              Show profile metadata (no passwords)
  delete <name>            Delete a saved profile

Save Options:
  --url <url>              Login page URL (required)
  --username <user>        Username (required)
  --password <pass>        Password (required unless --password-stdin)
  --password-stdin          Read password from stdin (recommended)
  --username-selector <s>  Custom CSS selector for username field
  --password-selector <s>  Custom CSS selector for password field
  --submit-selector <s>    Custom CSS selector for submit button

Global Options:
  --json                   Output as JSON
  --session <name>         Use specific session

Examples:
  echo "pass" | nstbrowser-ai-agent auth save github --url https://github.com/login --username user --password-stdin
  nstbrowser-ai-agent auth save github --url https://github.com/login --username user --password pass
  nstbrowser-ai-agent auth login github
  nstbrowser-ai-agent auth list
  nstbrowser-ai-agent auth show github
  nstbrowser-ai-agent auth delete github
"##
        }

        // === Confirm/Deny ===
        "confirm" | "deny" => {
            r##"
nstbrowser-ai-agent confirm/deny - Approve or deny pending actions

Usage:
  nstbrowser-ai-agent confirm <confirmation-id>
  nstbrowser-ai-agent deny <confirmation-id>

When --confirm-actions is set, certain action categories return a
confirmation_required response with a confirmation ID. Use confirm/deny
to approve or reject the action.

Pending confirmations auto-deny after 60 seconds.

Examples:
  nstbrowser-ai-agent confirm c_8f3a1234
  nstbrowser-ai-agent deny c_8f3a1234
"##
        }

        // === Dialog ===
        "dialog" => {
            r##"
nstbrowser-ai-agent dialog - Handle browser dialogs

Usage: nstbrowser-ai-agent dialog <response> [text]

Respond to browser dialogs (alert, confirm, prompt).

Operations:
  accept [text]        Accept dialog, optionally with prompt text
  dismiss              Dismiss/cancel dialog

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent dialog accept
  nstbrowser-ai-agent dialog accept "my input"
  nstbrowser-ai-agent dialog dismiss
"##
        }

        // === Trace ===
        "trace" => {
            r##"
nstbrowser-ai-agent trace - Record execution trace

Usage: nstbrowser-ai-agent trace <operation> [path]

Record a trace for debugging with Playwright Trace Viewer.

Operations:
  start [path]         Start recording trace
  stop [path]          Stop recording and save trace

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent trace start
  nstbrowser-ai-agent trace start ./my-trace
  nstbrowser-ai-agent trace stop
  nstbrowser-ai-agent trace stop ./debug-trace.zip
"##
        }

        // === Profile (CDP Tracing) ===
        "profiler" => {
            r##"
nstbrowser-ai-agent profiler - Record Chrome DevTools performance profile

Usage: nstbrowser-ai-agent profiler <operation> [options]

Record a performance profile using Chrome DevTools Protocol (CDP) Tracing.
The output JSON file can be loaded into Chrome DevTools Performance panel,
Perfetto UI (https://ui.perfetto.dev/), or other trace analysis tools.

Operations:
  start                Start profiling
  stop [path]          Stop profiling and save to file

Start Options:
  --categories <list>  Comma-separated trace categories (default includes
                       devtools.timeline, v8.execute, blink, and others)

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  # Basic profiling
  nstbrowser-ai-agent profiler start
  nstbrowser-ai-agent navigate https://example.com
  nstbrowser-ai-agent click "#button"
  nstbrowser-ai-agent profiler stop ./trace.json

  # With custom categories
  nstbrowser-ai-agent profiler start --categories "devtools.timeline,v8.execute,blink.user_timing"
  nstbrowser-ai-agent profiler stop ./custom-trace.json

The output file can be viewed in:
  - Chrome DevTools: Performance panel > Load profile
  - Perfetto: https://ui.perfetto.dev/
"##
        }

        // === Record (video) ===
        "record" => {
            r##"
nstbrowser-ai-agent record - Record browser session to video

Usage: nstbrowser-ai-agent record start <path.webm> [url]
       nstbrowser-ai-agent record stop
       nstbrowser-ai-agent record restart <path.webm> [url]

Record the browser to a WebM video file using Playwright's native recording.
Creates a fresh browser context but preserves cookies and localStorage.
If no URL is provided, automatically navigates to your current page.

Operations:
  start <path> [url]     Start recording (defaults to current URL if omitted)
  stop                   Stop recording and save video
  restart <path> [url]   Stop current recording (if any) and start a new one

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  # Record from current page (preserves login state)
  nstbrowser-ai-agent open https://app.example.com/dashboard
  nstbrowser-ai-agent snapshot -i            # Explore and plan
  nstbrowser-ai-agent record start ./demo.webm
  nstbrowser-ai-agent click @e3              # Execute planned actions
  nstbrowser-ai-agent record stop

  # Or specify a different URL
  nstbrowser-ai-agent record start ./demo.webm https://example.com

  # Restart recording with a new file (stops previous, starts new)
  nstbrowser-ai-agent record restart ./take2.webm
"##
        }

        // === Console/Errors ===
        "console" => {
            r##"
nstbrowser-ai-agent console - View console logs

Usage: nstbrowser-ai-agent console [--clear]

View browser console output (log, warn, error, info).

Options:
  --clear              Clear console log buffer

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent console
  nstbrowser-ai-agent console --clear
"##
        }
        "errors" => {
            r##"
nstbrowser-ai-agent errors - View page errors

Usage: nstbrowser-ai-agent errors [--clear]

View JavaScript errors and uncaught exceptions.

Options:
  --clear              Clear error buffer

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent errors
  nstbrowser-ai-agent errors --clear
"##
        }

        // === Highlight ===
        "highlight" => {
            r##"
nstbrowser-ai-agent highlight - Highlight an element

Usage: nstbrowser-ai-agent highlight <selector>

Visually highlights an element on the page for debugging.

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent highlight "#target-element"
  nstbrowser-ai-agent highlight @e5
"##
        }

        // === State ===
        "state" => {
            r##"
nstbrowser-ai-agent state - Manage browser state

Usage: nstbrowser-ai-agent state <operation> [args]

Save, restore, list, and manage browser state (cookies, localStorage, sessionStorage).

Operations:
  save <path>                        Save current state to file
  load <path>                        Load state from file
  list                               List saved state files
  show <filename>                    Show state summary
  rename <old-name> <new-name>       Rename state file
  clear [session-name] [--all]       Clear saved states
  clean --older-than <days>          Delete expired state files

Automatic State Persistence:
  Use --session-name to auto-save/restore state across restarts:
  nstbrowser-ai-agent --session-name myapp open https://example.com
  Or set NSTBROWSER_AI_AGENT_SESSION_NAME environment variable.

State Encryption:
  Set NSTBROWSER_AI_AGENT_ENCRYPTION_KEY (64-char hex) for AES-256-GCM encryption.
  Generate a key: openssl rand -hex 32

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent state save ./auth-state.json
  nstbrowser-ai-agent state load ./auth-state.json
  nstbrowser-ai-agent state list
  nstbrowser-ai-agent state show myapp-default.json
  nstbrowser-ai-agent state rename old-name new-name
  nstbrowser-ai-agent state clear --all
  nstbrowser-ai-agent state clean --older-than 7
"##
        }

        // === Session ===
        "session" => {
            r##"
nstbrowser-ai-agent session - Manage sessions

Usage: nstbrowser-ai-agent session [operation]

Manage isolated browser sessions. Each session has its own browser
instance with separate cookies, storage, and state.

Operations:
  (none)               Show current session name
  list                 List all active sessions

Environment:
  NSTBROWSER_AI_AGENT_SESSION    Default session name

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent session
  nstbrowser-ai-agent session list
  nstbrowser-ai-agent --session test open example.com
"##
        }

        // === Install ===
        "install" => {
            r##"
nstbrowser-ai-agent install - Install browser binaries

Usage: nstbrowser-ai-agent install [--with-deps]

Downloads and installs browser binaries required for automation.

Options:
  -d, --with-deps      Also install system dependencies (Linux only)

Examples:
  nstbrowser-ai-agent install
  nstbrowser-ai-agent install --with-deps
"##
        }

        // === Connect ===
        "connect" => {
            r##"
nstbrowser-ai-agent connect - Connect to browser via CDP

Usage: nstbrowser-ai-agent connect <port|url>

Connects to a running browser instance via Chrome DevTools Protocol (CDP).
This allows controlling browsers, Electron apps, or remote browser services.

Arguments:
  <port>               Local port number (e.g., 9222)
  <url>                Full WebSocket URL (ws://, wss://, http://, https://)

Supported URL formats:
  - Port number: 9222 (connects to http://localhost:9222)
  - WebSocket URL: ws://localhost:9222/devtools/browser/...
  - Remote service: wss://remote-browser.example.com/cdp?token=...

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  # Connect to local Chrome with remote debugging
  # Start Chrome: google-chrome --remote-debugging-port=9222
  nstbrowser-ai-agent connect 9222

  # Connect using WebSocket URL from /json/version endpoint
  nstbrowser-ai-agent connect "ws://localhost:9222/devtools/browser/abc123"

  # Connect to remote browser service
  nstbrowser-ai-agent connect "wss://browser-service.example.com/cdp?token=xyz"

  # After connecting, run commands normally
  nstbrowser-ai-agent snapshot
  nstbrowser-ai-agent click @e1
"##
        }

        "nst" => {
            r##"
nstbrowser-ai-agent nst - Nstbrowser Integration

Manage Nstbrowser profiles and browser instances for advanced fingerprinting
and anti-detection capabilities.

Usage: nstbrowser-ai-agent nst <category> <subcommand> [args]
   OR: nstbrowser-ai-agent <category> <subcommand> [args]  (when using NST as default provider)

Categories:
  browser              Manage browser instances
  profile              Manage browser profiles

Browser Commands:
  nst browser list                    List running browser instances
  nst browser start <profile-id>      Start browser for profile
  nst browser start-batch <id> [id...] Start multiple browsers in batch
  nst browser start-once              Start temporary browser without profile
  nst browser stop <profile-id>       Stop browser instance
  nst browser stop-all                Stop all browser instances
  nst browser cdp-url <profile-id>    Get CDP WebSocket URL for profile
  nst browser cdp-url-once            Get CDP URL for temporary browser
  nst browser connect <profile-id>    Connect and get CDP URL (starts if not running)
  nst browser connect-once            Connect to temporary browser

Profile Commands:
  nst profile list                    List all profiles
  nst profile list-cursor             List profiles with cursor pagination
    Options: --page-size <n>  --cursor <token>
  nst profile create <name>           Create new profile
    Options: --platform <Windows|macOS|Linux>
             --kernel <version>
             --group-id <id>
             --proxy-host <host> --proxy-port <port>
             --proxy-type <http|https|socks5>
             --proxy-username <user> --proxy-password <pass>
  nst profile delete <id> [id...]     Delete profiles
  nst profile proxy update <id>       Update proxy settings
  nst profile proxy reset <id> [id...] Reset proxy to local
  nst profile tags list               List all tags
  nst profile tags create <id> <tag>  Add tags to profile
  nst profile tags clear <id> [id...] Clear profile tags
  nst profile groups list             List all groups
  nst profile groups change <gid> <id> Move profiles to group
  nst profile cache clear <id> [id...] Clear profile cache
  nst profile cookies clear <id> [id...] Clear profile cookies

Default Provider Shortcuts (when NST_API_KEY is set):
  profile list                        Same as: nst profile list
  profile list-cursor                 Same as: nst profile list-cursor
  profile create <name>               Same as: nst profile create <name>
  browser list                        Same as: nst browser list
  browser start <profile-id>          Same as: nst browser start <profile-id>
  browser start-batch <id> [id...]    Same as: nst browser start-batch <id> [id...]
  browser start-once                  Same as: nst browser start-once
  browser cdp-url <profile-id>        Same as: nst browser cdp-url <profile-id>
  browser cdp-url-once                Same as: nst browser cdp-url-once
  browser connect <profile-id>        Same as: nst browser connect <profile-id>
  browser connect-once                Same as: nst browser connect-once
  (All nst commands work without 'nst' prefix when using NST as default provider)

Environment Variables:
  NST_HOST                 Nstbrowser API host (default: 127.0.0.1)
  NST_PORT                 Nstbrowser API port (default: 8848)
  NST_API_KEY              Nstbrowser API key (required)
  NST_PROFILE              Profile name for provider=nst launch (backward compatibility)
  NST_PROFILE_NAME         Profile name for provider=nst launch
  NST_PROFILE_ID           Profile ID for provider=nst launch

Configuration File:
  Config file location: ~/.nst-ai-agent/config.json
  Priority: Config file > Environment variables > Defaults
  
  Use 'config set' to configure once and use forever:
    nstbrowser-ai-agent config set key <your-api-key>
    nstbrowser-ai-agent config set host <custom-host>
    nstbrowser-ai-agent config set port <custom-port>

Options:
  --json                   Output as JSON
  --session <name>         Use specific session

Examples:
  # List all profiles
  nstbrowser-ai-agent nst profile list

  # Create a new profile with all options
  nstbrowser-ai-agent nst profile create myprofile \
    --platform Windows \
    --kernel "128" \
    --group-id "254861a7-f1af-4b6c-99c5-059e5036ae49" \
    --proxy-host 127.0.0.1 --proxy-port 1080 --proxy-type socks5

  # Start browser with profile
  nstbrowser-ai-agent nst browser start profile-123

  # Launch browser using Nstbrowser provider with profile name
  nstbrowser-ai-agent -p nst --profile myprofile

  # Launch browser using Nstbrowser provider with profile ID (auto-detected)
  nstbrowser-ai-agent -p nst --profile "527e7b55-ca19-4422-89e4-88af4cf0f543"

  # Both work the same way - UUID pattern is auto-detected
  nstbrowser-ai-agent -p nst --profile proxy_ph
  nstbrowser-ai-agent -p nst --profile ef2b083a-8f77-4a7f-8441-a8d56bbd832b

  # Launch browser using Nstbrowser provider (once profile, temporary)
  nstbrowser-ai-agent -p nst

  # Launch browser using environment variable (backward compatible)
  NST_PROFILE=myprofile nstbrowser-ai-agent -p nst
  nstbrowser-ai-agent -p nst open https://example.com

  # Update proxy settings
  nstbrowser-ai-agent nst profile proxy update profile-123 \
    --host 127.0.0.1 --port 1080 --type http

  # Batch operations
  nstbrowser-ai-agent nst profile delete profile-1 profile-2 profile-3
  nstbrowser-ai-agent nst profile cache clear profile-1 profile-2

Note: Requires Nstbrowser client to be installed and running.
      Set NST_API_KEY environment variable before using.
"##
        }

        "diff" => {
            r##"
nstbrowser-ai-agent diff - Compare page states

Subcommands:

  diff snapshot                   Compare current snapshot to last snapshot in session
  diff screenshot --baseline <f>  Visual pixel diff against a baseline image
  diff url <url1> <url2>          Compare two pages

Snapshot Diff:

  Usage: nstbrowser-ai-agent diff snapshot [options]

  Options:
    -b, --baseline <file>    Compare against a saved snapshot file
    -s, --selector <sel>     Scope snapshot to a CSS selector or @ref
    -c, --compact            Use compact snapshot format
    -d, --depth <n>          Limit snapshot tree depth

  Without --baseline, compares against the last snapshot taken in this session.

Screenshot Diff:

  Usage: nstbrowser-ai-agent diff screenshot --baseline <file> [options]

  Options:
    -b, --baseline <file>    Baseline image to compare against (required)
    -o, --output <file>      Path for the diff image (default: temp dir)
    -t, --threshold <0-1>    Color distance threshold (default: 0.1)
    -s, --selector <sel>     Scope screenshot to element
        --full               Full page screenshot

URL Diff:

  Usage: nstbrowser-ai-agent diff url <url1> <url2> [options]

  Options:
    --screenshot             Also compare screenshots (default: snapshot only)
    --full                   Full page screenshots
    --wait-until <strategy>  Navigation wait strategy: load, domcontentloaded, networkidle (default: load)
    -s, --selector <sel>     Scope snapshots to a CSS selector or @ref
    -c, --compact            Use compact snapshot format
    -d, --depth <n>          Limit snapshot tree depth

Global Options:
  --json               Output as JSON
  --session <name>     Use specific session

Examples:
  nstbrowser-ai-agent diff snapshot
  nstbrowser-ai-agent diff snapshot --baseline before.txt
  nstbrowser-ai-agent diff screenshot --baseline before.png
  nstbrowser-ai-agent diff screenshot --baseline before.png --output diff.png --threshold 0.2
  nstbrowser-ai-agent diff url https://staging.example.com https://prod.example.com
  nstbrowser-ai-agent diff url https://v1.example.com https://v2.example.com --screenshot
"##
        }

        _ => return false,
    };
    println!("{}", help.trim());
    true
}

pub fn print_help() {
    println!(
        r#"
nstbrowser-ai-agent - fast browser automation CLI for AI agents

Usage: nstbrowser-ai-agent <command> [args] [options]

Core Commands:
  open <url>                 Navigate to URL
  click <sel>                Click element (or @ref)
  dblclick <sel>             Double-click element
  type <sel> <text>          Type into element
  fill <sel> <text>          Clear and fill
  press <key>                Press key (Enter, Tab, Control+a)
  keyboard type <text>       Type text with real keystrokes (no selector)
  keyboard inserttext <text> Insert text without key events
  hover <sel>                Hover element
  focus <sel>                Focus element
  check <sel>                Check checkbox
  uncheck <sel>              Uncheck checkbox
  select <sel> <val...>      Select dropdown option
  drag <src> <dst>           Drag and drop
  upload <sel> <files...>    Upload files
  download <sel> <path>      Download file by clicking element
  scroll <dir> [px]          Scroll (up/down/left/right)
  scrollintoview <sel>       Scroll element into view
  wait <sel|ms>              Wait for element or time
  screenshot [path]          Take screenshot
  pdf <path>                 Save as PDF
  snapshot                   Accessibility tree with refs (for AI)
  eval <js>                  Run JavaScript
  connect <port|url>         Connect to browser via CDP
  close                      Close browser

Navigation:
  back                       Go back
  forward                    Go forward
  reload                     Reload page

Get Info:  nstbrowser-ai-agent get <what> [selector]
  text, html, value, attr <name>, title, url, count, box, styles

Check State:  nstbrowser-ai-agent is <what> <selector>
  visible, enabled, checked

Find Elements:  nstbrowser-ai-agent find <locator> <value> <action> [text]
  role, text, label, placeholder, alt, title, testid, first, last, nth

Mouse:  nstbrowser-ai-agent mouse <action> [args]
  move <x> <y>, down [btn], up [btn], wheel <dy> [dx]

Browser Settings:  nstbrowser-ai-agent set <setting> [value]
  viewport <w> <h>, device <name>, geo <lat> <lng>
  offline [on|off], headers <json>, credentials <user> <pass>
  media [dark|light] [reduced-motion]

Network:  nstbrowser-ai-agent network <action>
  route <url> [--abort|--body <json>]
  unroute [url]
  requests [--clear] [--filter <pattern>]

Storage:
  cookies [get|set|clear]    Manage cookies (set supports --url, --domain, --path, --httpOnly, --secure, --sameSite, --expires)
  storage <local|session>    Manage web storage

Tabs:
  tab [new|list|close|<n>]   Manage tabs

Diff:
  diff snapshot              Compare current vs last snapshot
  diff screenshot --baseline Compare current vs baseline image
  diff url <u1> <u2>         Compare two pages

Debug:
  trace start|stop [path]    Record Playwright trace
  profiler start|stop [path] Record Chrome DevTools profile
  record start <path> [url]  Start video recording (WebM)
  record stop                Stop and save video
  console [--clear]          View console logs
  errors [--clear]           View page errors
  highlight <sel>            Highlight element

Auth Vault:
  auth save <name> [opts]    Save auth profile (--url, --username, --password/--password-stdin)
  auth login <name>          Login using saved credentials
  auth list                  List saved auth profiles
  auth show <name>           Show auth profile metadata
  auth delete <name>         Delete auth profile

Configuration:
  config set <key> <value>   Set configuration value (key, host, port)
  config get <key>           Get configuration value
  config show                Show all configuration
  config unset <key>         Remove configuration value

Nstbrowser Integration:
  nst browser list           List running browser instances
  nst browser start <id>     Start browser for profile
  nst browser stop <id>      Stop browser instance
  nst profile list           List all profiles
  nst profile create <name>  Create new profile
  nst profile delete <id>    Delete profile(s)
  nst profile proxy update   Update proxy settings
  nst profile tags list      List all tags
  nst profile groups list    List all groups

Confirmation:
  confirm <id>               Approve a pending action
  deny <id>                  Deny a pending action

Sessions:
  session                    Show current session name
  session list               List active sessions

Setup:
  install                    Install browser binaries
  install --with-deps        Also install system dependencies (Linux)

Snapshot Options:
  -i, --interactive          Only interactive elements
  -c, --compact              Remove empty structural elements
  -d, --depth <n>            Limit tree depth
  -s, --selector <sel>       Scope to CSS selector

Default Provider:
  By default, nstbrowser-ai-agent uses Nstbrowser (nst) as the browser provider.
  This means you don't need to specify -p nst unless you want to be explicit.
  
  To use a local browser instead, use --local or --headed flags.
  
  Provider selection priority (highest to lowest):
    1. Explicit --provider flag
    2. --local flag (uses local browser)
    3. --headed flag (implies local)
    4. --cdp flag (implies local)
    5. --auto-connect flag (implies local)
    6. NST_API_KEY environment variable (uses nst)
    7. Default: nst (Nstbrowser)

Quick Start with Nstbrowser:
  # Set your API key (required for nst provider)
  export NST_API_KEY="your-api-key"
  
  # Launch browser (uses nst by default)
  nstbrowser-ai-agent open https://example.com
  
  # Nstbrowser management (no 'nst' prefix needed with default provider)
  nstbrowser-ai-agent profile list               # List profiles
  nstbrowser-ai-agent browser list               # List running browsers
  
  # Or use local browser mode
  nstbrowser-ai-agent --local open https://example.com

Options:
  --session <name>           Isolated session (or NSTBROWSER_AI_AGENT_SESSION env)
  --profile <path>           Persistent browser profile (or NSTBROWSER_AI_AGENT_PROFILE env)
  --state <path>             Load storage state from JSON file (or NSTBROWSER_AI_AGENT_STATE env)
  --headers <json>           HTTP headers scoped to URL's origin (for auth)
  --executable-path <path>   Custom browser executable (or NSTBROWSER_AI_AGENT_EXECUTABLE_PATH)
  --extension <path>         Load browser extensions (repeatable)
  --args <args>              Browser launch args, comma or newline separated (or NSTBROWSER_AI_AGENT_ARGS)
                             e.g., --args "--no-sandbox,--disable-blink-features=AutomationControlled"
  --user-agent <ua>          Custom User-Agent (or NSTBROWSER_AI_AGENT_USER_AGENT)
  --proxy <server>           Proxy server URL (or NSTBROWSER_AI_AGENT_PROXY)
                             e.g., --proxy "http://user:pass@127.0.0.1:7890"
  --proxy-bypass <hosts>     Bypass proxy for these hosts (or NSTBROWSER_AI_AGENT_PROXY_BYPASS)
                             e.g., --proxy-bypass "localhost,*.internal.com"
  --ignore-https-errors      Ignore HTTPS certificate errors
  --allow-file-access        Allow file:// URLs to access local files (Chromium only)
  -p, --provider <name>      Browser provider: nst (default), local
  --local                    Use local browser instead of Nstbrowser (or NSTBROWSER_AI_AGENT_LOCAL env)
  --profile <name|id>        Connect to Nstbrowser profile by name or ID (auto-detected)
                             Accepts profile name (e.g., "proxy_ph") or UUID
                             (e.g., "ef2b083a-8f77-4a7f-8441-a8d56bbd832b")
                             Can also be set via NST_PROFILE environment variable
  --profile-id <id>          Connect to Nstbrowser profile by ID (or NST_PROFILE_ID env)
  --browser-profile <path>   Local browser profile path (or NSTBROWSER_AI_AGENT_PROFILE env)
  --json                     JSON output
  --full, -f                 Full page screenshot
  --annotate                 Annotated screenshot with numbered labels and legend
  --headed                   Show browser window (not headless)
  --cdp <port>               Connect via CDP (Chrome DevTools Protocol)
  --auto-connect             Auto-discover and connect to running Chrome
  --color-scheme <scheme>    Color scheme: dark, light, no-preference (or NSTBROWSER_AI_AGENT_COLOR_SCHEME)
  --download-path <path>     Default download directory (or NSTBROWSER_AI_AGENT_DOWNLOAD_PATH)
  --session-name <name>      Auto-save/restore session state (cookies, localStorage)
  --content-boundaries       Wrap page output in boundary markers (or NSTBROWSER_AI_AGENT_CONTENT_BOUNDARIES)
  --max-output <chars>       Truncate page output to N chars (or NSTBROWSER_AI_AGENT_MAX_OUTPUT)
  --allowed-domains <list>   Restrict navigation domains (or NSTBROWSER_AI_AGENT_ALLOWED_DOMAINS)
  --action-policy <path>     Action policy JSON file (or NSTBROWSER_AI_AGENT_ACTION_POLICY)
  --confirm-actions <list>   Categories requiring confirmation (or NSTBROWSER_AI_AGENT_CONFIRM_ACTIONS)
  --confirm-interactive      Interactive confirmation prompts; auto-denies if stdin is not a TTY (or NSTBROWSER_AI_AGENT_CONFIRM_INTERACTIVE)
  --native                   [Experimental] Use native Rust daemon instead of Node.js (or NSTBROWSER_AI_AGENT_NATIVE)
  --config <path>            Use a custom config file (or NSTBROWSER_AI_AGENT_CONFIG env)
  --debug                    Debug output
  --version, -V              Show version

Configuration:
  nstbrowser-ai-agent looks for nstbrowser-ai-agent.json in these locations (lowest to highest priority):
    1. ~/.nstbrowser-ai-agent/config.json      User-level defaults
    2. ./nstbrowser-ai-agent.json              Project-level overrides
    3. Environment variables             Override config file values
    4. CLI flags                         Override everything

  Use --config <path> to load a specific config file instead of the defaults.
  If --config points to a missing or invalid file, nstbrowser-ai-agent exits with an error.

  Boolean flags accept an optional true/false value to override config:
    --headed           (same as --headed true)
    --headed false     (disables "headed": true from config)

  Extensions from user and project configs are merged (not replaced).

  Example nstbrowser-ai-agent.json:
    {{"headed": true, "proxy": "http://localhost:8080", "profile": "./browser-data"}}

.env File Support:
  Environment variables can be stored in .env files for easier configuration:
    1. .nstbrowser-ai-agent.env    Project-specific (highest priority)
    2. .env                        Standard environment file

  Example .nstbrowser-ai-agent.env:
    NST_API_KEY=your-api-key-here
    NST_HOST=api.nstbrowser.io
    NSTBROWSER_AI_AGENT_DEBUG=1

  Note: Never commit .env files with API keys to version control!

Environment:
  NSTBROWSER_AI_AGENT_CONFIG           Path to config file (or use --config)
  NSTBROWSER_AI_AGENT_SESSION          Session name (default: "default")
  NSTBROWSER_AI_AGENT_SESSION_NAME     Auto-save/restore state persistence name
  NSTBROWSER_AI_AGENT_ENCRYPTION_KEY   64-char hex key for AES-256-GCM state encryption
  NSTBROWSER_AI_AGENT_STATE_EXPIRE_DAYS Auto-delete states older than N days (default: 30)
  NSTBROWSER_AI_AGENT_EXECUTABLE_PATH  Custom browser executable path
  NSTBROWSER_AI_AGENT_EXTENSIONS       Comma-separated browser extension paths
  NSTBROWSER_AI_AGENT_HEADED           Show browser window (not headless)
  NSTBROWSER_AI_AGENT_JSON             JSON output
  NSTBROWSER_AI_AGENT_FULL             Full page screenshot
  NSTBROWSER_AI_AGENT_ANNOTATE         Annotated screenshot with numbered labels and legend
  NSTBROWSER_AI_AGENT_DEBUG            Debug output
  NSTBROWSER_AI_AGENT_IGNORE_HTTPS_ERRORS Ignore HTTPS certificate errors
  NSTBROWSER_AI_AGENT_PROVIDER         Browser provider (default: nst)
  NSTBROWSER_AI_AGENT_LOCAL            Use local browser instead of Nstbrowser
  NSTBROWSER_AI_AGENT_AUTO_CONNECT     Auto-discover and connect to running Chrome
  NSTBROWSER_AI_AGENT_ALLOW_FILE_ACCESS Allow file:// URLs to access local files
  NSTBROWSER_AI_AGENT_COLOR_SCHEME     Color scheme preference (dark, light, no-preference)
  NSTBROWSER_AI_AGENT_DOWNLOAD_PATH    Default download directory for browser downloads
  NSTBROWSER_AI_AGENT_DEFAULT_TIMEOUT  Default Playwright timeout in ms (default: 25000)
  NSTBROWSER_AI_AGENT_STREAM_PORT      Enable WebSocket streaming on port (e.g., 9223)
  NSTBROWSER_AI_AGENT_CONTENT_BOUNDARIES Wrap page output in boundary markers
  NSTBROWSER_AI_AGENT_MAX_OUTPUT       Max characters for page output
  NSTBROWSER_AI_AGENT_ALLOWED_DOMAINS  Comma-separated allowed domain patterns
  NSTBROWSER_AI_AGENT_ACTION_POLICY    Path to action policy JSON file
  NSTBROWSER_AI_AGENT_CONFIRM_ACTIONS  Action categories requiring confirmation
  NSTBROWSER_AI_AGENT_CONFIRM_INTERACTIVE Enable interactive confirmation prompts
  NSTBROWSER_AI_AGENT_NATIVE           Use native Rust daemon (experimental, no Node.js/Playwright)
  NST_API_KEY                    Nstbrowser API key (required for nst provider, default provider)
  NST_HOST                       Nstbrowser API host (default: localhost)
  NST_PORT                       Nstbrowser API port (default: 8848)
  NST_PROFILE                    Profile name for provider=nst launch

Install (recommended, fastest - native Rust CLI):
  npm install -g @nstbrowser/nstbrowser-ai-agent
  nstbrowser-ai-agent install                  # Download Chromium (first time)

Try without installing (slower, routes through Node.js):
  npx nstbrowser-ai-agent open example.com

Examples:
  # Using Nstbrowser (default provider)
  export NST_API_KEY="your-api-key"
  nstbrowser-ai-agent open example.com         # Uses nst by default
  nstbrowser-ai-agent snapshot -i              # Interactive elements only
  nstbrowser-ai-agent click @e2                # Click by ref from snapshot
  nstbrowser-ai-agent fill @e3 "test@example.com"
  
  # Using local browser mode
  nstbrowser-ai-agent --local open example.com
  nstbrowser-ai-agent --headed open example.com  # Visual browser (also uses local)
  
  # Other examples
  nstbrowser-ai-agent find role button click --name Submit
  nstbrowser-ai-agent get text @e1
  nstbrowser-ai-agent screenshot --full
  nstbrowser-ai-agent screenshot --annotate    # Labeled screenshot for vision models
  nstbrowser-ai-agent wait --load networkidle  # Wait for slow pages to load
  nstbrowser-ai-agent --cdp 9222 snapshot      # Connect via CDP port
  nstbrowser-ai-agent --auto-connect snapshot  # Auto-discover running Chrome
  nstbrowser-ai-agent --color-scheme dark open example.com  # Dark mode
  nstbrowser-ai-agent --profile ~/.myapp open example.com    # Persistent profile
  nstbrowser-ai-agent --session-name myapp open example.com  # Auto-save/restore state

Command Chaining:
  Chain commands with && in a single shell call (browser persists via daemon):

  nstbrowser-ai-agent open example.com && nstbrowser-ai-agent wait --load networkidle && nstbrowser-ai-agent snapshot -i
  nstbrowser-ai-agent fill @e1 "user@example.com" && nstbrowser-ai-agent fill @e2 "pass" && nstbrowser-ai-agent click @e3
  nstbrowser-ai-agent open example.com && nstbrowser-ai-agent wait --load networkidle && nstbrowser-ai-agent screenshot page.png
"#
    );
}

fn print_snapshot_diff(data: &serde_json::Map<String, serde_json::Value>) {
    let changed = data
        .get("changed")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !changed {
        println!("{} No changes detected", color::success_indicator());
        return;
    }
    if let Some(diff) = data.get("diff").and_then(|v| v.as_str()) {
        for line in diff.lines() {
            if line.starts_with("+ ") {
                println!("{}", color::green(line));
            } else if line.starts_with("- ") {
                println!("{}", color::red(line));
            } else {
                println!("{}", color::dim(line));
            }
        }
        let additions = data.get("additions").and_then(|v| v.as_i64()).unwrap_or(0);
        let removals = data.get("removals").and_then(|v| v.as_i64()).unwrap_or(0);
        let unchanged = data.get("unchanged").and_then(|v| v.as_i64()).unwrap_or(0);
        println!(
            "\n{} additions, {} removals, {} unchanged",
            color::green(&additions.to_string()),
            color::red(&removals.to_string()),
            unchanged
        );
    }
}

fn print_screenshot_diff(data: &serde_json::Map<String, serde_json::Value>) {
    let mismatch = data
        .get("mismatchPercentage")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let is_match = data.get("match").and_then(|v| v.as_bool()).unwrap_or(false);
    let dim_mismatch = data
        .get("dimensionMismatch")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if dim_mismatch {
        println!(
            "{} Images have different dimensions",
            color::error_indicator()
        );
    } else if is_match {
        println!(
            "{} Images match (0% difference)",
            color::success_indicator()
        );
    } else {
        println!(
            "{} {:.2}% pixels differ",
            color::error_indicator(),
            mismatch
        );
    }
    if let Some(diff_path) = data.get("diffPath").and_then(|v| v.as_str()) {
        println!("  Diff image: {}", color::green(diff_path));
    }
    let total = data
        .get("totalPixels")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    let different = data
        .get("differentPixels")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    println!(
        "  {} different / {} total pixels",
        color::red(&different.to_string()),
        total
    );
}

pub fn print_version() {
    println!("nstbrowser-ai-agent {}", env!("CARGO_PKG_VERSION"));
}

/// Print error message when Nstbrowser is not configured
pub fn show_nst_not_configured_error(validation_error: &str) {
    eprintln!("{} {}", color::error_indicator(), validation_error);
    eprintln!();
    eprintln!("{} Setup Required:", color::info_indicator());
    eprintln!();
    eprintln!("  1. Download and install Nstbrowser client from:");
    eprintln!("     {}", color::dim("https://www.nstbrowser.io"));
    eprintln!();
    eprintln!("  2. Start the Nstbrowser client application");
    eprintln!();
    eprintln!("  3. Get your API key from the Nstbrowser dashboard");
    eprintln!();
    eprintln!("  4. Configure the API key (choose one method):");
    eprintln!();
    eprintln!("     Method 1 (Recommended): Use config command");
    eprintln!(
        "       {}",
        color::dim("nstbrowser-ai-agent config set key your-api-key-here")
    );
    eprintln!();
    eprintln!("     Method 2: Set environment variable");
    eprintln!(
        "       {}",
        color::dim("export NST_API_KEY=your-api-key-here")
    );
    eprintln!();
    eprintln!("{} Documentation:", color::info_indicator());
    eprintln!("  https://github.com/nstbrowser/nstbrowser-ai-agent#nstbrowser-integration");
}

/// Print error message when Nstbrowser is not configured for NST-specific commands
pub fn show_nst_not_configured_error_for_nst_command(validation_error: &str, command: &str) {
    eprintln!("{} {}", color::error_indicator(), validation_error);
    eprintln!();
    eprintln!(
        "The '{}' command requires Nstbrowser to be configured.",
        color::yellow(command)
    );
    eprintln!();
    eprintln!("{} Setup Required:", color::info_indicator());
    eprintln!();
    eprintln!("  1. Download and install Nstbrowser client from:");
    eprintln!("     {}", color::dim("https://www.nstbrowser.io"));
    eprintln!();
    eprintln!("  2. Start the Nstbrowser client application");
    eprintln!();
    eprintln!("  3. Get your API key from the Nstbrowser dashboard");
    eprintln!();
    eprintln!("  4. Configure the API key (choose one method):");
    eprintln!();
    eprintln!("     Method 1 (Recommended): Use config command");
    eprintln!(
        "       {}",
        color::dim("nstbrowser-ai-agent config set key your-api-key-here")
    );
    eprintln!();
    eprintln!("     Method 2: Set environment variable");
    eprintln!(
        "       {}",
        color::dim("export NST_API_KEY=your-api-key-here")
    );
    eprintln!();
    eprintln!("{} Documentation:", color::info_indicator());
    eprintln!("  https://github.com/nstbrowser/nstbrowser-ai-agent#nstbrowser-integration");
}

/// Print error message when Nstbrowser is not configured (with local mode alternative)
pub fn show_nst_not_configured_error_with_local_alternative(validation_error: &str) {
    eprintln!("{} {}", color::error_indicator(), validation_error);
    eprintln!();
    eprintln!(
        "{} Option 1: Use Nstbrowser (default)",
        color::info_indicator()
    );
    eprintln!();
    eprintln!("  1. Download and install Nstbrowser client from:");
    eprintln!("     {}", color::dim("https://www.nstbrowser.io"));
    eprintln!();
    eprintln!("  2. Start the Nstbrowser client and get your API key");
    eprintln!();
    eprintln!("  3. Configure the API key (choose one method):");
    eprintln!();
    eprintln!("     Method 1 (Recommended): Use config command");
    eprintln!(
        "       {}",
        color::dim("nstbrowser-ai-agent config set key your-api-key-here")
    );
    eprintln!();
    eprintln!("     Method 2: Set environment variable");
    eprintln!(
        "       {}",
        color::dim("export NST_API_KEY=your-api-key-here")
    );
    eprintln!();
    eprintln!(
        "{} Option 2: Use Local Browser Mode",
        color::info_indicator()
    );
    eprintln!();
    eprintln!("  Use the --local flag to run with your local browser:");
    eprintln!(
        "    {}",
        color::dim("nstbrowser-ai-agent --local open example.com")
    );
    eprintln!();
    eprintln!("{} Documentation:", color::info_indicator());
    eprintln!("  https://github.com/nstbrowser/nstbrowser-ai-agent#nstbrowser-integration");
}

/// Print error message for invalid Nstbrowser configuration
pub fn show_nst_config_invalid_error(field: &str, reason: &str) {
    eprintln!(
        "{} Invalid Nstbrowser configuration",
        color::error_indicator()
    );
    eprintln!();
    eprintln!("  Field: {}", color::yellow(field));
    eprintln!("  Issue: {}", reason);
    eprintln!();
    eprintln!("{} Expected Format:", color::info_indicator());
    eprintln!();
    match field {
        "NST_API_KEY" => {
            eprintln!("  {} A valid API key (10-500 characters)", color::dim("•"));
            eprintln!(
                "  {} Example: {}",
                color::dim("•"),
                color::dim("export NST_API_KEY=nst_1234567890abcdef")
            );
        }
        "NST_HOST" => {
            eprintln!("  {} Hostname or IP address (no protocol)", color::dim("•"));
            eprintln!(
                "  {} Example: {}",
                color::dim("•"),
                color::dim("export NST_HOST=api.nstbrowser.io")
            );
            eprintln!(
                "  {} Example: {}",
                color::dim("•"),
                color::dim("export NST_HOST=192.168.1.100")
            );
        }
        "NST_PORT" => {
            eprintln!("  {} Port number (1-65535)", color::dim("•"));
            eprintln!(
                "  {} Example: {}",
                color::dim("•"),
                color::dim("export NST_PORT=443")
            );
        }
        _ => {}
    }
    eprintln!();
    eprintln!("{} Documentation:", color::info_indicator());
    eprintln!("  https://github.com/nstbrowser/nstbrowser-ai-agent#configuration");
}

/// Print error message for Nstbrowser connection failures
pub fn show_nst_connection_error(error_details: &str) {
    eprintln!(
        "{} Failed to connect to Nstbrowser",
        color::error_indicator()
    );
    eprintln!();
    eprintln!("  {}", error_details);
    eprintln!();
    eprintln!("{} Troubleshooting Steps:", color::info_indicator());
    eprintln!();
    eprintln!("  {} Verify your API key is correct", color::dim("1."));
    eprintln!("  {} Check your internet connection", color::dim("2."));
    eprintln!(
        "  {} Ensure NST_HOST and NST_PORT are correct (if set)",
        color::dim("3.")
    );
    eprintln!(
        "  {} Try using --debug flag for more details",
        color::dim("4.")
    );
    eprintln!();
    eprintln!("{} Example:", color::info_indicator());
    eprintln!(
        "  {}",
        color::dim("nstbrowser-ai-agent --debug open example.com")
    );
    eprintln!();
    eprintln!("{} Need Help?", color::info_indicator());
    eprintln!("  https://github.com/nstbrowser/nstbrowser-ai-agent/issues");
}

/// Print error message for profile-related errors
pub fn show_nst_profile_error(operation: &str, error_details: &str) {
    eprintln!(
        "{} Nstbrowser profile {} failed",
        color::error_indicator(),
        operation
    );
    eprintln!();
    eprintln!("  {}", error_details);
    eprintln!();
    eprintln!("{} Common Issues:", color::info_indicator());
    eprintln!();
    match operation {
        "creation" => {
            eprintln!("  {} Profile name already exists", color::dim("•"));
            eprintln!("  {} Invalid profile configuration", color::dim("•"));
            eprintln!("  {} API quota exceeded", color::dim("•"));
        }
        "connection" => {
            eprintln!("  {} Profile does not exist", color::dim("•"));
            eprintln!("  {} Profile is already in use", color::dim("•"));
            eprintln!("  {} Insufficient permissions", color::dim("•"));
        }
        _ => {
            eprintln!("  {} Profile not found", color::dim("•"));
            eprintln!("  {} Invalid profile ID or name", color::dim("•"));
        }
    }
    eprintln!();
    eprintln!("{} Documentation:", color::info_indicator());
    eprintln!("  https://github.com/nstbrowser/nstbrowser-ai-agent#profile-management");
}
