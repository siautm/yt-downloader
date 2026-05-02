//! Hard-burn subtitles into MP4 with ffmpeg (re-encode video; audio copy).

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::ytdlp::{check_ffmpeg, resolve_ffmpeg_binary};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

fn apply_no_window(cmd: &mut Command) {
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
}

/// Parse merged container path (`mp4`, `mkv`, …) from yt-dlp stderr/stdout lines.
pub fn parse_ytdlp_merged_destination(line: &str, ext: &str) -> Option<PathBuf> {
    let ext_l = ext.to_ascii_lowercase();
    if line.contains("[Merger]") && line.contains("Merging formats into \"") {
        let key = "Merging formats into \"";
        let i = line.find(key)? + key.len();
        let rest = &line[i..];
        let end = rest.find('"')?;
        let p = PathBuf::from(rest[..end].trim());
        if p.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case(ext_l.as_str()))
            == Some(true)
        {
            return Some(p);
        }
        return None;
    }
    if line.contains("[download]") && line.contains("Destination:") {
        let key = "Destination:";
        let idx = line.find(key)? + key.len();
        let mut rest = line[idx..].trim();
        if rest.starts_with('"') && rest.ends_with('"') && rest.len() >= 2 {
            rest = &rest[1..rest.len() - 1];
        }
        let p = PathBuf::from(rest);
        if p.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case(ext_l.as_str()))
            == Some(true)
        {
            return Some(p);
        }
    }
    None
}

/// Parse final merged MP4 path from yt-dlp stderr/stdout lines.
#[allow(dead_code)] // Used by unit tests; `queue` uses [`parse_ytdlp_merged_destination`].
pub fn parse_ytdlp_mp4_destination(line: &str) -> Option<PathBuf> {
    parse_ytdlp_merged_destination(line, "mp4")
}

/// Unify punctuation / spaces that yt-dlp may render differently between merged MP4 and `.srt` names.
fn normalize_for_filename_match(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '｜' | '︱' | '│' | '￤' => '|',
            '：' => ':',
            '；' => ';',
            '（' => '(',
            '）' => ')',
            '＃' => '#',
            '\u{3000}' | '\u{00a0}' => ' ',
            c if c.is_whitespace() => ' ',
            _ => c,
        })
        .collect()
}

/// Last `.tag` is a subtitle language code like `zh-Hant` or `en-US`.
fn looks_like_bcp47_tag(s: &str) -> bool {
    let s = s.trim();
    if s.len() < 2 || s.len() > 42 {
        return false;
    }
    let mut parts = s.split('-');
    let first = match parts.next() {
        Some(x) => x,
        None => return false,
    };
    if !(2..=8).contains(&first.len()) || !first.chars().all(|c| c.is_ascii_alphabetic()) {
        return false;
    }
    // Avoid treating `Episode.Title` as `Title` + lang `Episode`.
    if !s.contains('-') && !(2..=3).contains(&first.len()) {
        return false;
    }
    for p in parts {
        if p.is_empty() || p.len() > 8 || !p.chars().all(|c| c.is_ascii_alphanumeric()) {
            return false;
        }
    }
    true
}

fn split_sub_stem_language(stem: &str) -> Option<(&str, &str)> {
    let (base, tag) = stem.rsplit_once('.')?;
    if looks_like_bcp47_tag(tag) {
        Some((base, tag))
    } else {
        None
    }
}

fn zh_cross_fallback_codes(lang: &str) -> Vec<String> {
    let l = lang.trim().to_ascii_lowercase().replace('_', "-");
    match l.as_str() {
        "zh-hans" | "zh-cn" | "cmn" => vec![
            "zh-Hant".into(),
            "zh-TW".into(),
            "zh-HK".into(),
            "zh-MO".into(),
            "zh".into(),
        ],
        "zh-hant" | "zh-tw" | "zh-hk" | "zh-mo" => vec!["zh-Hans".into(), "zh-CN".into(), "zh".into()],
        _ => vec![],
    }
}

fn file_stem_ends_with_lang(full_stem: &str, code: &str) -> bool {
    let suf = format!(".{}", code.trim());
    full_stem
        .to_ascii_lowercase()
        .ends_with(&suf.to_ascii_lowercase())
}

fn allowed_subtitle_tags_for_lookup(lang: &str) -> Vec<String> {
    let mut v = vec![lang.trim().to_string()];
    v.extend(zh_cross_fallback_codes(lang));
    let mut seen = std::collections::HashSet::<String>::new();
    let mut out = Vec::new();
    for t in v {
        let k = t.to_ascii_lowercase();
        if seen.insert(k) {
            out.push(t);
        }
    }
    out
}

fn srt_base_before_lang_path(p: &Path) -> Option<String> {
    let stem = p.file_stem()?.to_str()?;
    Some(
        split_sub_stem_language(stem)
            .map(|(b, _)| b.to_string())
            .unwrap_or_else(|| stem.to_string()),
    )
}

/// When merged MP4 uses a **truncated** stem but `.srt` keeps the full YouTube title, match by
/// subtitle language tag + recency + rough title overlap (same download folder).
fn subtitle_base_overlap_score(mp4_stem: &str, srt_base: &str) -> i32 {
    let mn = normalize_for_filename_match(mp4_stem);
    let bn = normalize_for_filename_match(srt_base);
    if bn.contains(&mn) {
        return 1_000_000;
    }
    if !bn.is_empty() && mn.contains(&bn) {
        return 900_000;
    }
    let mut best = 0i32;
    let mut cur = String::new();
    for c in mn.chars() {
        if c.is_alphanumeric() || c == '_' || c == '-' {
            cur.push(c);
        } else {
            if cur.len() >= 8 && bn.contains(&cur) {
                best = best.max(800_000 + cur.len() as i32);
            }
            cur.clear();
        }
    }
    if cur.len() >= 8 && bn.contains(&cur) {
        best = best.max(800_000 + cur.len() as i32);
    }
    if best > 0 {
        return best;
    }
    for tok in mn.split(|c: char| !(c.is_alphanumeric() || c == '#' || c == '_')) {
        if tok.len() >= 8 && bn.contains(tok) {
            return 800_000 + tok.len() as i32;
        }
    }
    mn.chars()
        .zip(bn.chars())
        .take_while(|(a, b)| a == b)
        .count() as i32
}

fn episode_hash_token(stem: &str) -> Option<String> {
    let pos = stem.find('#')?;
    let digits: String = stem[pos + 1..]
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect();
    if digits.is_empty() {
        return None;
    }
    Some(format!("#{digits}"))
}

fn max_mtime_tagged_srts_in_dir(dir: &Path, tags_lc: &HashSet<String>) -> Option<SystemTime> {
    let mut best: Option<SystemTime> = None;
    for e in fs::read_dir(dir).ok()?.flatten() {
        let p = e.path();
        if p.extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case("srt")) != Some(true) {
            continue;
        }
        let Some(stem) = p.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        let Some((_, tag)) = split_sub_stem_language(stem) else {
            continue;
        };
        if !tags_lc.contains(&tag.to_ascii_lowercase()) {
            continue;
        }
        let Ok(m) = fs::metadata(&p).and_then(|x| x.modified()) else {
            continue;
        };
        best = Some(match best {
            None => m,
            Some(b) if m > b => m,
            Some(b) => b,
        });
    }
    best
}

fn mtime_anchor_for_loose_find(mp4: &Path, tags_lc: &HashSet<String>) -> SystemTime {
    fs::metadata(mp4)
        .and_then(|m| m.modified())
        .unwrap_or_else(|_| {
            mp4
                .parent()
                .and_then(|d| max_mtime_tagged_srts_in_dir(d, tags_lc))
                .unwrap_or_else(SystemTime::now)
        })
}

fn find_srt_by_lang_suffix_loose(mp4: &Path, lang: &str) -> Option<PathBuf> {
    const LOOKBACKS: &[u64] = &[7200, 86_400, 604_800];
    for &secs in LOOKBACKS {
        if let Some(p) = find_srt_by_lang_suffix_in_window(mp4, lang, Duration::from_secs(secs)) {
            return Some(p);
        }
    }
    None
}

fn find_srt_by_lang_suffix_in_window(mp4: &Path, lang: &str, lookback: Duration) -> Option<PathBuf> {
    let dir = mp4.parent()?;
    let tags_lc: HashSet<String> = allowed_subtitle_tags_for_lookup(lang)
        .into_iter()
        .map(|t| t.to_ascii_lowercase())
        .collect();
    let anchor = mtime_anchor_for_loose_find(mp4, &tags_lc);
    let lower = anchor.checked_sub(lookback).unwrap_or(std::time::UNIX_EPOCH);
    let upper = anchor
        .checked_add(Duration::from_secs(30 * 86_400))
        .unwrap_or(anchor);
    let mp4_stem = mp4.file_stem().and_then(|s| s.to_str()).unwrap_or("");
    let ep = episode_hash_token(mp4_stem);

    let mut hits: Vec<(PathBuf, SystemTime, i32)> = Vec::new();
    for e in fs::read_dir(dir).ok()?.flatten() {
        let p = e.path();
        if p.extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case("srt")) != Some(true) {
            continue;
        }
        let stem = match p.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s,
            None => continue,
        };
        let tag = match split_sub_stem_language(stem) {
            Some((_, t)) => t,
            None => continue,
        };
        if !tags_lc.contains(&tag.to_ascii_lowercase()) {
            continue;
        }
        let m = fs::metadata(&p).ok()?.modified().ok()?;
        if m < lower || m > upper {
            continue;
        }
        let base = match srt_base_before_lang_path(&p) {
            Some(b) => b,
            None => continue,
        };
        let mut score = subtitle_base_overlap_score(mp4_stem, &base);
        if let Some(ref t) = ep {
            if base.contains(t) {
                score += 500_000;
            }
        }
        hits.push((p, m, score));
    }
    if hits.is_empty() {
        return None;
    }
    hits.sort_by(|(_, ma, sa), (_, mb, sb)| sb.cmp(sa).then_with(|| mb.cmp(ma)));
    Some(hits[0].0.clone())
}

/// Same folder, matching language tag, **ignore mtime** (use when clock / touch skew breaks windows).
fn find_srt_by_lang_tag_ignore_mtime(mp4: &Path, lang: &str) -> Option<PathBuf> {
    let dir = mp4.parent()?;
    let tags_lc: HashSet<String> = allowed_subtitle_tags_for_lookup(lang)
        .into_iter()
        .map(|t| t.to_ascii_lowercase())
        .collect();
    let mp4_stem = mp4.file_stem().and_then(|s| s.to_str()).unwrap_or("");
    let ep = episode_hash_token(mp4_stem);
    let mut hits: Vec<(PathBuf, SystemTime, i32)> = Vec::new();
    for e in fs::read_dir(dir).ok()?.flatten() {
        let p = e.path();
        if p.extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case("srt")) != Some(true) {
            continue;
        }
        let stem = match p.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s,
            None => continue,
        };
        let tag = match split_sub_stem_language(stem) {
            Some((_, t)) => t,
            None => continue,
        };
        if !tags_lc.contains(&tag.to_ascii_lowercase()) {
            continue;
        }
        let base = match srt_base_before_lang_path(&p) {
            Some(b) => b,
            None => continue,
        };
        let mut score = subtitle_base_overlap_score(mp4_stem, &base);
        if let Some(ref t) = ep {
            if base.contains(t) {
                score += 500_000;
            }
        }
        let m = fs::metadata(&p).ok()?.modified().ok()?;
        hits.push((p, m, score));
    }
    if hits.is_empty() {
        return None;
    }
    hits.sort_by(|(_, ma, sa), (_, mb, sb)| sb.cmp(sa).then_with(|| mb.cmp(ma)));
    Some(hits[0].0.clone())
}

fn prefer_srt_from_hits(hits: &[PathBuf], lang: &str) -> Option<PathBuf> {
    let mut order: Vec<String> = vec![lang.trim().to_string()];
    order.extend(zh_cross_fallback_codes(lang));
    for code in &order {
        for p in hits {
            if let Some(fst) = p.file_stem().and_then(|s| s.to_str()) {
                if file_stem_ends_with_lang(fst, code) {
                    return Some(p.clone());
                }
            }
        }
    }
    None
}

/// Match `.srt` whose stem is `{video_base}.{lang}` when `video_base` matches the MP4 stem after
/// normalizing fullwidth / halfwidth punctuation (fixes `｜` vs `|` mismatches).
fn find_srt_by_normalized_video_stem(mp4: &Path, lang: &str) -> Option<PathBuf> {
    let dir = mp4.parent()?;
    let mp4_stem = mp4.file_stem()?.to_str()?;
    let mp4_n = normalize_for_filename_match(mp4_stem);
    let mut hits: Vec<PathBuf> = Vec::new();
    for e in fs::read_dir(dir).ok()?.flatten() {
        let p = e.path();
        if p.extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case("srt")) != Some(true) {
            continue;
        }
        let srt_stem = match p.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s,
            None => continue,
        };
        let (base, _tag) = match split_sub_stem_language(srt_stem) {
            Some(x) => x,
            None => continue,
        };
        if normalize_for_filename_match(base) == mp4_n {
            hits.push(p);
        }
    }
    if hits.is_empty() {
        return None;
    }
    hits.sort();
    prefer_srt_from_hits(&hits, lang).or_else(|| hits.first().cloned())
}

/// Locate sidecar `.srt` next to `mp4` for yt-dlp `--sub-langs` preference (e.g. `en`, `zh-Hans`).
pub fn find_sidecar_srt(mp4: &Path, lang: &str) -> Option<PathBuf> {
    let dir = mp4.parent()?;
    let stem = mp4.file_stem()?.to_string_lossy();
    let lang = lang.trim();
    if lang.is_empty() {
        return None;
    }
    let exact = dir.join(format!("{stem}.{lang}.srt"));
    if exact.is_file() {
        return Some(exact);
    }
    for alt in zh_cross_fallback_codes(lang) {
        let p = dir.join(format!("{stem}.{alt}.srt"));
        if p.is_file() {
            return Some(p);
        }
    }
    if let Some(p) = find_srt_by_normalized_video_stem(mp4, lang) {
        return Some(p);
    }
    let rd = fs::read_dir(dir).ok()?;
    let mut hits: Vec<PathBuf> = rd
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case("srt")) == Some(true)
                && p
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .map(|s| s.starts_with(&format!("{stem}.")))
                    .unwrap_or(false)
        })
        .collect();
    hits.sort();
    if !hits.is_empty() {
        return prefer_srt_from_hits(&hits, lang).or_else(|| hits.first().cloned());
    }
    find_srt_by_lang_suffix_loose(mp4, lang).or_else(|| find_srt_by_lang_tag_ignore_mtime(mp4, lang))
}

/// yt-dlp may log a **truncated** merge path while the real file on disk uses the **full YouTube title**.
/// If the log path is missing, pick the best matching `.mp4` / `.mkv` in the same folder (episode + resolution + overlap).
pub fn resolve_merged_media_for_output(log_path: &Path, media_ext: &str) -> Option<PathBuf> {
    let ext_l = media_ext.to_ascii_lowercase();
    if log_path.is_file() {
        return Some(log_path.to_path_buf());
    }
    let parent = log_path.parent()?;
    let log_stem = log_path.file_stem().and_then(|s| s.to_str())?;
    let ep = episode_hash_token(log_stem);
    let log_l = log_stem.to_ascii_lowercase();

    let mut hits: Vec<(PathBuf, SystemTime, i32)> = Vec::new();
    for e in fs::read_dir(parent).ok()?.flatten() {
        let p = e.path();
        if p.extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case(ext_l.as_str())) != Some(true) {
            continue;
        }
        let stem = match p.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s,
            None => continue,
        };
        if let Some(ref t) = ep {
            if !stem.contains(t) {
                continue;
            }
        }
        let st = stem.to_ascii_lowercase();
        if log_l.contains("2160") && !st.contains("2160") {
            continue;
        }
        if log_l.contains("1440") && !st.contains("1440") {
            continue;
        }
        if log_l.contains("1080") && !st.contains("1080") {
            continue;
        }
        if log_l.contains("720") && !log_l.contains("1080") && !st.contains("720") {
            continue;
        }
        if log_l.contains("480") && !st.contains("480") {
            continue;
        }
        if log_l.contains("360") && !st.contains("360") {
            continue;
        }

        let mut score = subtitle_base_overlap_score(log_stem, stem);
        if let Some(ref t) = ep {
            if stem.contains(t) {
                score += 500_000;
            }
        }
        let Ok(m) = fs::metadata(&p).and_then(|x| x.modified()) else {
            continue;
        };
        hits.push((p, m, score));
    }
    if hits.is_empty() {
        return None;
    }
    hits.sort_by(|(_, ma, sa), (_, mb, sb)| sb.cmp(sa).then_with(|| mb.cmp(ma)));
    Some(hits[0].0.clone())
}

/// If the log path is missing, pick the best matching `.mp4` in the same folder.
#[allow(dead_code)] // Used by unit tests; `queue` uses [`resolve_merged_media_for_output`].
pub fn resolve_merged_mp4_for_burn(mp4_from_ytdlp_log: &Path) -> Option<PathBuf> {
    resolve_merged_media_for_output(mp4_from_ytdlp_log, "mp4")
}

/// Keep one `.srt` next to the video (prefer user language, deprioritize `.auto` / auto captions).
pub fn dedupe_sidecar_srts_keep_best(video: &Path, preferred_sub_lang: &str) {
    let pref = preferred_sub_lang.trim().to_lowercase().replace('_', "-");
    if pref.is_empty() {
        return;
    }
    let Some(parent) = video.parent() else {
        return;
    };
    let Some(stem) = video.file_stem().and_then(|s| s.to_str()) else {
        return;
    };
    let prefix = format!("{stem}.");
    let mut candidates: Vec<PathBuf> = Vec::new();
    let Ok(rd) = fs::read_dir(parent) else {
        return;
    };
    for e in rd.flatten() {
        let p = e.path();
        if !p.is_file() {
            continue;
        }
        if p.extension()
            .and_then(|x| x.to_str())
            .map(|x| x.eq_ignore_ascii_case("srt"))
            != Some(true)
        {
            continue;
        }
        let Some(sst) = p.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        if sst == stem || sst.starts_with(&prefix) {
            candidates.push(p);
        }
    }
    if candidates.len() <= 1 {
        return;
    }
    let mut scored: Vec<(i32, PathBuf)> = candidates
        .into_iter()
        .map(|p| (dedupe_srt_score(&p, stem, &pref), p))
        .collect();
    scored.sort_by(|a, b| b.0.cmp(&a.0));
    let keep = scored[0].1.clone();
    for (_, p) in scored.into_iter().skip(1) {
        if p != keep {
            let _ = fs::remove_file(&p);
        }
    }
}

fn dedupe_srt_score(path: &Path, video_stem: &str, pref: &str) -> i32 {
    let Some(sst) = path.file_stem().and_then(|s| s.to_str()) else {
        return 0;
    };
    let su = sst.to_ascii_lowercase();
    let mut s = 0;
    if su.contains(".auto") || su.contains("auto-") {
        s -= 200;
    }
    let suffix = if su == video_stem.to_ascii_lowercase() {
        String::new()
    } else if let Some(rest) = su.strip_prefix(&(video_stem.to_ascii_lowercase() + ".")) {
        rest.to_string()
    } else {
        return -1000;
    };
    let tag = suffix.split('.').next().unwrap_or(&suffix).replace('_', "-");
    if tag == pref {
        s += 500;
    } else if suffix.replace('_', "-").contains(pref) || pref.contains(&tag) {
        s += 120;
    }
    s -= (sst.len() as i32).min(40);
    s
}

/// Build `-vf subtitles=…` for ffmpeg.
///
/// Shorthand `subtitles='…path…'` with forward slashes. On Windows, `C:/…` must become
/// `C\:/…` inside the quotes — otherwise `:` still splits filter options (`filename='C` then
/// `:/Users/…` → parse errors / bogus `original_size`). Caller should use an ASCII-only temp
/// `.srt` path.
fn subtitles_filter_value(abs_srt: &Path) -> Result<String, String> {
    let s = abs_srt
        .to_str()
        .ok_or_else(|| "subtitle path is not valid UTF-8".to_string())?
        .replace('\\', "/");
    let with_drive = if s.len() >= 2 {
        let b = s.as_bytes();
        if b[1] == b':' && b[0].is_ascii_alphabetic() {
            format!("{}\\:{}", &s[..1], &s[2..])
        } else {
            s
        }
    } else {
        s
    };
    let escaped = with_drive.replace('\'', r"\'");
    Ok(format!("subtitles='{escaped}'"))
}

/// Re-encode video with subtitles drawn on; replace `mp4` in place on success.
pub fn burn_subtitles_into_mp4(
    mp4: &Path,
    srt: &Path,
    mut on_line: impl FnMut(&str),
) -> Result<(), String> {
    if !mp4.is_file() {
        return Err(format!("MP4 not found: {}", mp4.display()));
    }
    if !srt.is_file() {
        return Err(format!("SRT not found: {}", srt.display()));
    }

    // ffmpeg subtitles filter + Windows output: long Unicode paths (`#`, `《》`, spaces) break
    // filter parsing or file creation. Use ASCII-only temp files under the system temp dir.
    let tmp_dir = std::env::temp_dir();
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros();
    let base = format!("ytdl_burn_{}_{}", std::process::id(), stamp);
    let tmp_srt = tmp_dir.join(format!("{base}.srt"));
    // Intermediate MP4 next to the final file: ASCII-only name, same volume as `mp4` for
    // rename; avoids `%TEMP%` output failures on some Windows setups.
    let parent = mp4.parent().unwrap_or_else(|| Path::new("."));
    let tmp_out = parent.join(format!("{base}.out.mp4"));

    fs::copy(srt, &tmp_srt).map_err(|e| {
        format!(
            "copy srt to temp for ffmpeg subtitles filter ({}): {e}",
            tmp_srt.display()
        )
    })?;

    let vf = subtitles_filter_value(&tmp_srt)?;

    let mut cmd = Command::new(resolve_ffmpeg_binary());
    apply_no_window(&mut cmd);
    cmd.args([
        "-hide_banner",
        "-loglevel",
        "info",
        "-stats",
        "-y",
    ]);
    cmd.arg("-i").arg(mp4);
    cmd.arg("-vf").arg(&vf);
    cmd.args([
        "-c:a",
        "copy",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "23",
        "-movflags",
        "+faststart",
    ]);
    cmd.arg(&tmp_out);
    cmd.stderr(Stdio::piped());
    cmd.stdout(Stdio::null());

    on_line("[app] ffmpeg: burning subtitles (re-encoding video, audio copy)…");
    let out = cmd.output().map_err(|e| format!("ffmpeg spawn failed: {e}"))?;
    let err = String::from_utf8_lossy(&out.stderr);
    for ln in err.lines() {
        let t = ln.trim();
        if !t.is_empty() {
            on_line(t);
        }
    }
    let cleanup_tmps = || {
        let _ = fs::remove_file(&tmp_srt);
        let _ = fs::remove_file(&tmp_out);
    };

    if !out.status.success() {
        cleanup_tmps();
        return Err("ffmpeg burn-in failed (see log lines above).".to_string());
    }

    if !tmp_out.is_file() {
        cleanup_tmps();
        return Err("ffmpeg finished but temp output missing.".to_string());
    }

    fs::remove_file(mp4).map_err(|e| format!("remove original mp4: {e}"))?;
    fs::rename(&tmp_out, mp4).map_err(|e| {
        format!(
            "rename burned mp4 into place (original removed; recovery file: {}): {e}",
            tmp_out.display()
        )
    })?;
    let _ = fs::remove_file(&tmp_srt);

    Ok(())
}

/// Remux MP4 with stream copy and mark the **first subtitle stream** as `default`, so players
/// (notably VLC on Windows) are more likely to **auto-enable** embedded soft subs without a sidecar `.srt`.
/// Returns `true` if the file was replaced. Returns `false` if skipped (no ffmpeg, no subs, or ffmpeg could not map `s:0`).
pub fn try_set_mp4_first_subtitle_track_default(mp4: &Path) -> Result<bool, String> {
    if !check_ffmpeg() || !mp4.is_file() {
        return Ok(false);
    }
    if mp4.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("mp4")) != Some(true) {
        return Ok(false);
    }
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros();
    let tmp = std::env::temp_dir().join(format!(
        "ytdl_mp4subdef_{}_{}.mp4",
        std::process::id(),
        stamp
    ));

    let mut cmd = Command::new(resolve_ffmpeg_binary());
    apply_no_window(&mut cmd);
    cmd.args(["-hide_banner", "-loglevel", "error", "-y", "-i"])
        .arg(mp4)
        .args([
            "-map",
            "0",
            "-c",
            "copy",
            "-disposition:s:0",
            "default",
            "-movflags",
            "+faststart",
        ])
        .arg(&tmp);

    let out = cmd.output().map_err(|e| e.to_string())?;
    if !out.status.success() || !tmp.is_file() {
        let _ = fs::remove_file(&tmp);
        return Ok(false);
    }

    fs::remove_file(mp4).map_err(|e| format!("remove mp4 for subtitle-default remux: {e}"))?;
    fs::copy(&tmp, mp4).map_err(|e| {
        format!(
            "copy remuxed mp4 after subtitle-default flag (recovery file may be {}): {e}",
            tmp.display()
        )
    })?;
    let _ = fs::remove_file(&tmp);
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subtitles_filter_escapes_windows_drive_colon_inside_quotes() {
        let p = PathBuf::from(r"C:\Temp\ytdl_burn_1_2.srt");
        let vf = super::subtitles_filter_value(&p).unwrap();
        assert_eq!(vf, r"subtitles='C\:/Temp/ytdl_burn_1_2.srt'");
    }

    #[test]
    fn subtitles_filter_unix_path_quoted() {
        let p = PathBuf::from("/tmp/ytdl_burn_1.srt");
        let vf = super::subtitles_filter_value(&p).unwrap();
        assert_eq!(vf, "subtitles='/tmp/ytdl_burn_1.srt'");
    }

    #[test]
    fn parses_merger_mp4_path() {
        let line = r#"[Merger] Merging formats into "C:\dl\My Video_1080p.mp4""#;
        let p = parse_ytdlp_mp4_destination(line).unwrap();
        assert!(p.to_string_lossy().contains("My Video_1080p.mp4"));
    }

    #[test]
    fn parses_download_destination_mp4() {
        let line = "[download] Destination: D:\\tmp\\out.mp4";
        let p = parse_ytdlp_mp4_destination(line).unwrap();
        assert!(p.ends_with("out.mp4"));
    }

    #[test]
    fn parses_merger_mkv_path() {
        let line = r#"[Merger] Merging formats into "D:\tmp\Show_1080p.mkv""#;
        let p = parse_ytdlp_merged_destination(line, "mkv").unwrap();
        assert!(p.to_string_lossy().to_lowercase().contains("show_1080p.mkv"));
    }

    #[test]
    fn dedupe_keeps_preferred_lang_srt() {
        let dir = std::env::temp_dir().join(format!("dedupe_srt_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let v = dir.join("Ep_1080p.mkv");
        let keep = dir.join("Ep_1080p.zh-Hans.srt");
        let drop = dir.join("Ep_1080p.zh-Hant.srt");
        fs::write(&v, b"v").unwrap();
        fs::write(&keep, b"a").unwrap();
        fs::write(&drop, b"b").unwrap();
        super::dedupe_sidecar_srts_keep_best(&v, "zh-Hans");
        assert!(keep.is_file());
        assert!(!drop.is_file());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn find_sidecar_prefers_traditional_when_user_asked_hans() {
        let dir = std::env::temp_dir().join(format!("burn_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let mp4 = dir.join("Show_1080p.mp4");
        let srt = dir.join("Show_1080p.zh-Hant.srt");
        fs::write(&mp4, b"0").unwrap();
        fs::write(&srt, b"1").unwrap();
        let got = super::find_sidecar_srt(&mp4, "zh-Hans").unwrap();
        assert_eq!(got, srt);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn find_sidecar_unifies_fullwidth_parens_between_mp4_and_srt() {
        let dir = std::env::temp_dir().join(format!("burn_paren_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let ascii = "Show (x)_1080p";
        let fullw = "Show （x）_1080p";
        let mp4 = dir.join(format!("{ascii}.mp4"));
        let srt = dir.join(format!("{fullw}.zh-Hant.srt"));
        fs::write(&mp4, b"0").unwrap();
        fs::write(&srt, b"1").unwrap();
        let got = super::find_sidecar_srt(&mp4, "zh-Hans").unwrap();
        assert_eq!(got, srt);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn find_sidecar_loose_when_mp4_stem_is_truncated_suffix_of_srt_base() {
        let dir = std::env::temp_dir().join(format!("burn_trunc_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let short_stem = "#10 ( )Ani-One Asia_1080p";
        let long_base = format!("《Test》_{short_stem}_tail");
        let mp4 = dir.join(format!("{short_stem}.mp4"));
        let srt = dir.join(format!("{long_base}.zh-Hant.srt"));
        fs::write(&mp4, b"0").unwrap();
        fs::write(&srt, b"1").unwrap();
        let got = super::find_sidecar_srt(&mp4, "zh-Hans").unwrap();
        assert_eq!(got, srt);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn find_sidecar_loose_shared_brand_resolution_token() {
        let dir = std::env::temp_dir().join(format!("burn_token_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let mp4 = dir.join("#10 ( )Ani-One Asia_1080p.mp4");
        let srt = dir.join("《M》#10 (繁) Ani-One Asia_1080p.zh-Hant.srt");
        fs::write(&mp4, b"0").unwrap();
        fs::write(&srt, b"1").unwrap();
        let got = super::find_sidecar_srt(&mp4, "zh-Hans").unwrap();
        assert_eq!(got, srt);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_merged_mp4_when_log_path_truncated_file_missing() {
        let dir = std::env::temp_dir().join(format!("burn_res_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let log = dir.join("#12 ( )Ani-One Asia_1080p.mp4");
        let real = dir.join("《X》#12 (a) Ani-One Asia_1080p.mp4");
        fs::write(&real, b"v").unwrap();
        let got = super::resolve_merged_mp4_for_burn(&log).unwrap();
        assert_eq!(got, real);
        let _ = fs::remove_dir_all(&dir);
    }
}
