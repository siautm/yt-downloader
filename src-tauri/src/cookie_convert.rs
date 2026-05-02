//! Convert browser-extension JSON cookie exports to Netscape `cookies.txt` for yt-dlp.
//! Supports: top-level `[{...}]`, or `{ "cookies": [...] }` (Cookie-Editor style).

use serde_json::Value;
use std::path::{Path, PathBuf};
use uuid::Uuid;

fn strip_bom_and_trim(raw: &str) -> &str {
    raw.strip_prefix('\u{FEFF}')
        .unwrap_or(raw)
        .trim()
}

/// Extract one top-level `[...]` or `{...}` slice (handles trailing garbage after valid JSON).
fn extract_first_balanced_value(s: &str) -> Option<&str> {
    let t = s.trim_start();
    let first = t.chars().next()?;
    if first == '[' {
        return extract_balanced(t, '[', ']');
    }
    if first == '{' {
        return extract_balanced(t, '{', '}');
    }
    None
}

fn extract_balanced(s: &str, open: char, close: char) -> Option<&str> {
    let start = s.find(open)?;
    let mut depth = 0_i32;
    let mut in_string = false;
    let mut escape = false;
    for (i, ch) in s.char_indices().skip(start) {
        if escape {
            escape = false;
            continue;
        }
        if in_string {
            if ch == '\\' {
                escape = true;
            } else if ch == '"' {
                in_string = false;
            }
            continue;
        }
        match ch {
            '"' => in_string = true,
            c if c == open => depth += 1,
            c if c == close => {
                depth -= 1;
                if depth == 0 {
                    return Some(&s[start..=i]);
                }
            }
            _ => {}
        }
    }
    None
}

/// Parse extension export; strips BOM/trim and ignores trailing non-JSON after the first value.
pub fn parse_loose_cookie_json(raw: &str) -> Result<Value, String> {
    let s = strip_bom_and_trim(raw);
    if s.is_empty() {
        return Err("Cookies file is empty.".to_string());
    }
    if let Ok(v) = serde_json::from_str::<Value>(s) {
        return Ok(v);
    }
    let slice = extract_first_balanced_value(s).ok_or_else(|| {
        "Cookies JSON is invalid: could not find a top-level [ ] or { } value.".to_string()
    })?;
    serde_json::from_str(slice).map_err(|e| {
        format!(
            "Cookies JSON is invalid (often extra text after the closing ] or }}): {e}"
        )
    })
}

fn cookie_obj_field<'a>(
    obj: &'a serde_json::Map<String, Value>,
    keys: &[&str],
) -> Option<&'a Value> {
    for k in keys {
        if let Some(v) = obj.get(*k) {
            return Some(v);
        }
        for (ok, ov) in obj.iter() {
            if ok.eq_ignore_ascii_case(k) {
                return Some(ov);
            }
        }
    }
    None
}

/// Extract cookie objects from extension JSON (array root or `{ "cookies": [...] }`).
pub fn cookie_entries_from_root_value(v: &Value) -> Result<Vec<Value>, String> {
    match v {
        Value::Array(a) => Ok(a.clone()),
        Value::Object(o) => {
            let arr = cookie_obj_field(o, &["cookies", "cookie"])
                .and_then(|x| x.as_array())
                .ok_or_else(|| {
                    "Expected a JSON array, or an object with a \"cookies\" array.".to_string()
                })?;
            Ok(arr.clone())
        }
        _ => Err(
            "Cookies JSON must be an array of cookie objects, or {\"cookies\":[...]}.".to_string(),
        ),
    }
}

/// Parses extension JSON and returns Netscape HTTP Cookie File contents.
pub fn extension_json_to_netscape(raw: &str) -> Result<String, String> {
    let v: Value =
        parse_loose_cookie_json(raw).map_err(|e| format!("Cookies JSON: {e}"))?;
    let entries = cookie_entries_from_root_value(&v)?;

    if entries.is_empty() {
        return Err("The cookies JSON contains no entries.".to_string());
    }

    let mut out = String::from("# Netscape HTTP Cookie File\n# Converted for yt-dlp\n\n");
    for item in &entries {
        let obj = item
            .as_object()
            .ok_or_else(|| "Each cookie must be a JSON object.".to_string())?;

        let name = cookie_obj_field(obj, &["name"])
            .and_then(|x| x.as_str())
            .ok_or_else(|| "A cookie entry is missing \"name\".".to_string())?;
        let value = cookie_obj_field(obj, &["value"])
            .map(|x| {
                x.as_str()
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| x.to_string())
            })
            .unwrap_or_default();

        let domain = cookie_obj_field(obj, &["domain", "host"])
            .and_then(|x| x.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| ".youtube.com".to_string())
            .trim()
            .to_string();

        let path = cookie_obj_field(obj, &["path"])
            .and_then(|x| x.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| "/".to_string());

        let secure = cookie_obj_field(obj, &["secure", "isSecure"])
            .and_then(|x| x.as_bool())
            .unwrap_or(true);

        let http_only = cookie_obj_field(obj, &["httpOnly", "httponly", "isHttpOnly"])
            .and_then(|x| x.as_bool())
            .unwrap_or(false);

        let host_only = cookie_obj_field(obj, &["hostOnly", "hostonly", "isHostOnly"])
            .and_then(|x| x.as_bool())
            .unwrap_or(false);

        let exp = cookie_obj_field(
            obj,
            &[
                "expirationDate",
                "expiration",
                "expires",
                "expiry",
                "expire",
            ],
        )
        .and_then(|x| {
            x.as_f64()
                .or_else(|| x.as_i64().map(|i| i as f64))
                .or_else(|| x.as_u64().map(|u| u as f64))
        })
        .unwrap_or(0.0_f64)
        .round() as i64;

        let mut dom = if domain.starts_with('.') || domain.starts_with("http") {
            domain
        } else if host_only {
            domain
        } else {
            format!(".{domain}")
        };

        if http_only && !dom.starts_with("#HttpOnly_") {
            dom = format!("#HttpOnly_{dom}");
        }

        let include_sub = if host_only { "FALSE" } else { "TRUE" };

        let value_esc = value.replace('\t', " ");

        let line = format!(
            "{}\t{}\t{}\t{}\t{}\t{}\t{}\n",
            dom,
            include_sub,
            path,
            if secure { "TRUE" } else { "FALSE" },
            exp,
            name,
            value_esc
        );
        out.push_str(&line);
    }

    if !out.contains(".google.com") && !out.contains("google.com") {
        out.push_str(
            "\n# If yt-dlp still reports \"Sign in to confirm you're not a bot\", export cookies while\n\
# logged in; many extensions include accounts.google.com cookies in the same export as YouTube.\n",
        );
    }

    Ok(out)
}

/// If `path` is `.json`, convert to a fresh temp Netscape file; otherwise return the same path.
pub fn resolve_cookies_path_for_ytdlp(user_path: &str) -> Result<Option<PathBuf>, String> {
    let f = user_path.trim();
    if f.is_empty() {
        return Ok(None);
    }
    let p = Path::new(f);
    if !p.is_file() {
        return Err(format!("Cookie path is not a file: {f}"));
    }

    if f.to_lowercase().ends_with(".json") {
        let raw =
            std::fs::read_to_string(p).map_err(|e| format!("Could not read cookies file: {e}"))?;
        let netscape = extension_json_to_netscape(&raw)?;
        let out = std::env::temp_dir().join(format!(
            "local-video-downloader-ytdlp-cookies-{}.txt",
            Uuid::new_v4()
        ));
        std::fs::write(&out, netscape)
            .map_err(|e| format!("Could not write converted cookies: {e}"))?;
        Ok(Some(out))
    } else {
        Ok(Some(p.to_path_buf()))
    }
}
