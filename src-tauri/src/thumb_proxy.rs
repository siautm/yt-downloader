//! Fetch hotlink-protected thumbnails (e.g. Bilibili `*.hdslb.com`) with a browser-like Referer.

use base64::Engine;
use std::io::Read;

fn host_after_scheme(url: &str) -> Option<&str> {
    let u = url.trim();
    let rest = u.strip_prefix("https://").or_else(|| u.strip_prefix("http://"))?;
    rest.split('/').next()
}

fn bilibili_referer_for_host(host: &str) -> &'static str {
    let h = host.to_ascii_lowercase();
    if h.contains("bstar") {
        "https://www.bilibili.tv/"
    } else {
        "https://www.bilibili.com/"
    }
}

fn host_allowed_for_proxy(host: &str) -> bool {
    let h = host.to_ascii_lowercase();
    h.ends_with(".hdslb.com")
        || h == "hdslb.com"
        || h.ends_with(".biliimg.com")
        || h == "biliimg.com"
        || h.ends_with(".bstarstatic.com")
        || h == "bstarstatic.com"
}

/// GET `url` with Referer suitable for Bilibili CDNs; return `data:<mime>;base64,...` for `<img src>`.
pub fn fetch_thumbnail_data_url(url: &str) -> Result<String, String> {
    let url = url.trim();
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("thumbnail URL must be http(s)".to_string());
    }
    let host = host_after_scheme(url).ok_or_else(|| "thumbnail URL has no host".to_string())?;
    if !host_allowed_for_proxy(host) {
        return Err(format!(
            "thumbnail host not allowed for in-app fetch: {host}"
        ));
    }
    let referer = bilibili_referer_for_host(host);

    let resp = ureq::get(url)
        .set("Referer", referer)
        .set(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        )
        .timeout(std::time::Duration::from_secs(25))
        .call()
        .map_err(|e| format!("thumbnail GET failed: {e}"))?;

    let status = resp.status();
    if !(200..300).contains(&status) {
        return Err(format!("thumbnail HTTP {status}"));
    }

    let mime = resp
        .header("Content-Type")
        .and_then(|h| h.split(';').next())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("image/jpeg")
        .to_string();

    let mut body = Vec::new();
    resp
        .into_reader()
        .take(8 * 1024 * 1024)
        .read_to_end(&mut body)
        .map_err(|e| format!("thumbnail read failed: {e}"))?;

    if body.is_empty() {
        return Err("empty thumbnail body".to_string());
    }

    let b64 = base64::engine::general_purpose::STANDARD.encode(&body);
    Ok(format!("data:{mime};base64,{b64}"))
}
