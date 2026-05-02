use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;

use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::ffmpeg_burn::{
    burn_subtitles_into_mp4, dedupe_sidecar_srts_keep_best, find_sidecar_srt, parse_ytdlp_merged_destination,
    resolve_merged_media_for_output, try_set_mp4_first_subtitle_track_default,
};
use crate::models::{NewTaskPayload, OutputFormat, QueueTask, TaskStatus};
use crate::ytdlp::{
    build_ytdlp_args, check_ffmpeg, download_pipeline_phase_total, parse_download_progress_line,
    resolve_ytdlp_binary,
};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Remove sidecar `.srt` files next to the merged MP4 (`stem.srt`, `stem.*.srt`).
fn delete_sidecar_srts_next_to_mp4(mp4: &Path) {
    let Some(parent) = mp4.parent() else {
        return;
    };
    let Some(stem) = mp4.file_stem().and_then(|s| s.to_str()) else {
        return;
    };
    let prefix = format!("{stem}.");
    let Ok(entries) = fs::read_dir(parent) else {
        return;
    };
    for ent in entries.flatten() {
        let p = ent.path();
        if !p.is_file() {
            continue;
        }
        if !p
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("srt"))
            .unwrap_or(false)
        {
            continue;
        }
        let Some(srt_stem) = p.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        if srt_stem == stem || srt_stem.starts_with(&prefix) {
            let _ = fs::remove_file(&p);
        }
    }
}

fn apply_no_window(cmd: &mut Command) {
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
}

pub struct DownloadEngine {
    tasks: Arc<Mutex<Vec<QueueTask>>>,
    current_id: Arc<Mutex<Option<String>>>,
    child: Arc<Mutex<Option<std::process::Child>>>,
    wake_tx: Mutex<Option<mpsc::Sender<()>>>,
}

impl DownloadEngine {
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(Vec::new())),
            current_id: Arc::new(Mutex::new(None)),
            child: Arc::new(Mutex::new(None)),
            wake_tx: Mutex::new(None),
        }
    }

    pub fn ensure_worker(&self, app: AppHandle) {
        let mut slot = self.wake_tx.lock().unwrap();
        if slot.is_some() {
            return;
        }
        let (tx, rx) = mpsc::channel::<()>();
        *slot = Some(tx.clone());
        let tasks = self.tasks.clone();
        let current_id = self.current_id.clone();
        let child = self.child.clone();
        thread::spawn(move || loop {
            let _ = rx.recv();
            while let Some((idx, id)) = pop_next_pending(&tasks) {
                run_one_download(
                    app.clone(),
                    &tasks,
                    &current_id,
                    &child,
                    idx,
                    &id,
                    &tx,
                );
            }
        });
    }

    pub fn push_tasks(&self, app: &AppHandle, payloads: Vec<NewTaskPayload>) -> Result<(), String> {
        {
            let mut g = self.tasks.lock().unwrap();
            for p in payloads {
                g.push(QueueTask {
                    id: Uuid::new_v4().to_string(),
                    url: p.url,
                    title: p.title,
                    status: TaskStatus::Pending,
                    progress: 0.0,
                    speed: String::new(),
                    eta: String::new(),
                    download_phase: 1,
                    download_phase_total: 1,
                    file_path: None,
                    error: None,
                    options: p.options,
                });
            }
        }
        let _ = app.emit("queue:update", self.snapshot());
        if let Some(tx) = self.wake_tx.lock().unwrap().as_ref() {
            let _ = tx.send(());
        }
        Ok(())
    }

    pub fn snapshot(&self) -> Vec<QueueTask> {
        self.tasks.lock().unwrap().clone()
    }

    pub fn cancel_task(&self, app: &AppHandle, id: &str) -> Result<(), String> {
        {
            let mut g = self.tasks.lock().unwrap();
            for t in g.iter_mut() {
                if t.id == id {
                    if matches!(
                        t.status,
                        TaskStatus::Pending | TaskStatus::Downloading | TaskStatus::Paused
                    ) {
                        t.status = TaskStatus::Cancelled;
                        t.error = Some("Cancelled".to_string());
                    }
                    break;
                }
            }
        }
        let cur = self.current_id.lock().unwrap().clone();
        if cur.as_deref() == Some(id) {
            if let Some(mut c) = self.child.lock().unwrap().take() {
                let _ = c.kill();
            }
        }
        let _ = app.emit("queue:update", self.snapshot());
        Ok(())
    }

    pub fn pause_task(&self, app: &AppHandle, id: &str) -> Result<(), String> {
        {
            let mut g = self.tasks.lock().unwrap();
            for t in g.iter_mut() {
                if t.id != id {
                    continue;
                }
                match t.status {
                    TaskStatus::Downloading => {
                        t.status = TaskStatus::Paused;
                    }
                    TaskStatus::Pending => {
                        t.status = TaskStatus::Paused;
                    }
                    _ => {}
                }
                break;
            }
        }
        let cur = self.current_id.lock().unwrap().clone();
        if cur.as_deref() == Some(id) {
            if let Some(mut c) = self.child.lock().unwrap().take() {
                let _ = c.kill();
            }
        }
        let _ = app.emit("queue:update", self.snapshot());
        Ok(())
    }

    pub fn resume_task(&self, app: &AppHandle, id: &str) -> Result<(), String> {
        {
            let mut g = self.tasks.lock().unwrap();
            for t in g.iter_mut() {
                if t.id == id && t.status == TaskStatus::Paused {
                    t.status = TaskStatus::Pending;
                    t.progress = 0.0;
                    t.download_phase = 1;
                    t.download_phase_total = download_pipeline_phase_total(&t.options);
                    break;
                }
            }
        }
        let _ = app.emit("queue:update", self.snapshot());
        if let Some(tx) = self.wake_tx.lock().unwrap().as_ref() {
            let _ = tx.send(());
        }
        Ok(())
    }
}

fn pop_next_pending(tasks: &Arc<Mutex<Vec<QueueTask>>>) -> Option<(usize, String)> {
    let g = tasks.lock().unwrap();
    g.iter()
        .enumerate()
        .find(|(_, t)| t.status == TaskStatus::Pending)
        .map(|(i, t)| (i, t.id.clone()))
}

fn merged_container_ext(fmt: OutputFormat) -> Option<&'static str> {
    match fmt {
        OutputFormat::Mp4 => Some("mp4"),
        OutputFormat::Mkv => Some("mkv"),
        _ => None,
    }
}

#[allow(clippy::too_many_arguments)]
fn run_one_download(
    app: AppHandle,
    tasks: &Arc<Mutex<Vec<QueueTask>>>,
    current_id: &Arc<Mutex<Option<String>>>,
    child_holder: &Arc<Mutex<Option<std::process::Child>>>,
    task_index: usize,
    task_id: &str,
    wake_tx: &mpsc::Sender<()>,
) {
    let (url, opts) = {
        let g = tasks.lock().unwrap();
        match g.get(task_index) {
            Some(t) => (t.url.clone(), t.options.clone()),
            None => {
                let _ = wake_tx.send(());
                return;
            }
        }
    };

    let ytdlp = resolve_ytdlp_binary();
    if !crate::ytdlp::check_ytdlp(&ytdlp) {
        fail_task(
            &app,
            tasks,
            task_id,
            "yt-dlp not found. Use a `tools` folder next to the app, PATH, or set YT_DLP.",
        );
        let _ = wake_tx.send(());
        return;
    }
    let out_dir = Path::new(&opts.download_dir);
    if opts.download_dir.trim().is_empty() || !out_dir.is_dir() {
        fail_task(
            &app,
            tasks,
            task_id,
            "Invalid download directory. Pick a folder in Settings.",
        );
        let _ = wake_tx.send(());
        return;
    }

    {
        let mut g = tasks.lock().unwrap();
        if let Some(t) = g.iter_mut().find(|x| x.id == task_id) {
            if t.status == TaskStatus::Cancelled {
                let _ = app.emit("queue:update", g.clone());
                let _ = wake_tx.send(());
                return;
            }
            t.status = TaskStatus::Downloading;
            t.progress = 0.0;
            t.speed.clear();
            t.eta.clear();
            t.download_phase = 1;
            t.download_phase_total = download_pipeline_phase_total(&opts);
            t.error = None;
        }
        let _ = app.emit("queue:update", g.clone());
    }

    let pipeline_total = download_pipeline_phase_total(&opts);
    if matches!(opts.output_format, OutputFormat::Mp4 | OutputFormat::Mkv)
        && opts.subtitle_lang.trim().is_empty()
    {
        let _ = app.emit(
            "task:log",
            serde_json::json!({
                "id": task_id,
                "line": "[app] No subtitle language selected — the video file will have no subtitle track. Pick a language under Download options to embed subs.",
                "stream": "ytdlp"
            }),
        );
    }

    let args = match build_ytdlp_args(&ytdlp, &url, &opts) {
        Ok(a) => a,
        Err(e) => {
            fail_task(&app, tasks, task_id, &e);
            let _ = wake_tx.send(());
            return;
        }
    };
    {
        let fmt = match opts.output_format {
            OutputFormat::Mp4 => "mp4",
            OutputFormat::Mkv => "mkv",
            OutputFormat::Mp3 => "mp3",
            OutputFormat::M4a => "m4a",
        };
        let sl = opts.subtitle_lang.trim();
        let burn = opts.burn_in_subtitles;
        let will_soft_embed =
            matches!(opts.output_format, OutputFormat::Mp4 | OutputFormat::Mkv) && !sl.is_empty() && !burn;
        let line = format!(
            "[app] output_format={fmt} subtitle_lang={} burn_in={burn} -> yt-dlp soft_embed_subs={}",
            if sl.is_empty() {
                "(empty)"
            } else {
                sl
            },
            will_soft_embed
        );
        let _ = app.emit(
            "task:log",
            serde_json::json!({ "id": task_id, "line": line, "stream": "ytdlp" }),
        );
    }
    let mut cmd = Command::new(&ytdlp);
    apply_no_window(&mut cmd);
    for a in &args {
        cmd.arg(a);
    }
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            fail_task(
                &app,
                tasks,
                task_id,
                &format!("Failed to spawn yt-dlp: {e}"),
            );
            let _ = wake_tx.send(());
            return;
        }
    };

    // yt-dlp may print `--progress` lines on stdout or stderr; read both so pipes never block.
    let stderr = child.stderr.take();
    let stdout = child.stdout.take();
    {
        let mut ch = child_holder.lock().unwrap();
        *ch = Some(child);
    }
    *current_id.lock().unwrap() = Some(task_id.to_string());

    let (line_tx, line_rx) = mpsc::channel::<String>();
    let tx_err = line_tx.clone();
    let tx_out = line_tx.clone();
    drop(line_tx);

    let mut last_merged: Option<std::path::PathBuf> = None;
    let mut last_pct: f64 = -1.0;
    let mut phase: u8 = 1;

    let h_err = thread::spawn(move || {
        if let Some(r) = stderr {
            let reader = BufReader::new(r);
            for line in reader.lines().map_while(Result::ok) {
                if tx_err.send(line).is_err() {
                    break;
                }
            }
        }
    });

    let h_out = thread::spawn(move || {
        if let Some(r) = stdout {
            let reader = BufReader::new(r);
            for line in reader.lines().map_while(Result::ok) {
                if tx_out.send(line).is_err() {
                    break;
                }
            }
        }
    });

    for line in line_rx {
        if was_cancelled_or_paused(tasks, task_id) {
            break;
        }
        // Windows / some terminals: multiple `[download]` updates separated by `\r` on one read.
        for segment in line.split('\r') {
            let segment = segment.trim();
            if segment.is_empty() {
                continue;
            }
            let _ = app.emit(
                "task:log",
                serde_json::json!({ "id": task_id, "line": segment, "stream": "ytdlp" }),
            );
            if let Some(ext) = merged_container_ext(opts.output_format) {
                if let Some(p) = parse_ytdlp_merged_destination(segment, ext) {
                    last_merged = Some(p);
                }
            }
            if let Some(p) = parse_download_progress_line(segment) {
                let pct = p.progress;
                if pipeline_total > 1
                    && last_pct >= 85.0
                    && pct <= 12.0
                    && last_pct > pct
                {
                    phase = (phase + 1).min(pipeline_total);
                }
                last_pct = pct;
                patch_task_progress(
                    &app,
                    tasks,
                    task_id,
                    pct,
                    &p.speed,
                    &p.eta,
                    phase,
                    pipeline_total,
                );
            }
            // Merge is phase 3 (video=1, audio=2, merge=3); Merger often prints little or no `%`.
            if matches!(opts.output_format, OutputFormat::Mp4 | OutputFormat::Mkv)
                && pipeline_total >= 3
                && phase < 3
                && (segment.contains("[Merger]") || segment.contains("Merging formats into"))
            {
                phase = 3;
                last_pct = -1.0;
            }
        }
    }

    let _ = h_err.join();
    let _ = h_out.join();

    let exit_ok = {
        let mut ch = child_holder.lock().unwrap();
        if let Some(mut c) = ch.take() {
            c.wait().map(|s| s.success()).unwrap_or(false)
        } else {
            false
        }
    };

    *current_id.lock().unwrap() = None;

    if was_cancelled(tasks, task_id) {
        let _ = wake_tx.send(());
        return;
    }

    if was_paused_after_kill(tasks, task_id) {
        let _ = app.emit("queue:update", tasks.lock().unwrap().clone());
        let _ = wake_tx.send(());
        return;
    }

    // End of yt-dlp for merged video: snap UI to phase 3 so combined progress hits 100% (3/3) or 75% (3/4 before burn).
    if exit_ok && matches!(opts.output_format, OutputFormat::Mp4 | OutputFormat::Mkv) && pipeline_total >= 3 {
        snap_mp4_mux_end_after_ytdlp(&app, tasks, task_id, pipeline_total);
    }

    let mut final_ok = exit_ok;
    let mut err_note: Option<String> = None;

    let merged_media_path: Option<PathBuf> = if exit_ok {
        merged_container_ext(opts.output_format).and_then(|ext| {
            last_merged.as_ref().and_then(|p| {
                resolve_merged_media_for_output(p, ext).or_else(|| p.is_file().then(|| p.to_path_buf()))
            })
        })
    } else {
        None
    };

    if exit_ok && !opts.subtitle_lang.trim().is_empty() {
        if let Some(ref v) = merged_media_path {
            if matches!(opts.output_format, OutputFormat::Mp4 | OutputFormat::Mkv) {
                dedupe_sidecar_srts_keep_best(v, opts.subtitle_lang.trim());
            }
        }
    }

    if exit_ok
        && matches!(opts.output_format, OutputFormat::Mp4)
        && !opts.burn_in_subtitles
        && !opts.subtitle_lang.trim().is_empty()
    {
        if let Some(ref v) = merged_media_path {
            match try_set_mp4_first_subtitle_track_default(v) {
                Ok(true) => {
                    let _ = app.emit(
                        "task:log",
                        serde_json::json!({
                            "id": task_id,
                            "line": "[app] Marked first embedded subtitle as default (ffmpeg remux, stream copy) — helps VLC auto-show soft subs without a sidecar .srt.",
                            "stream": "ytdlp"
                        }),
                    );
                }
                Ok(false) => {}
                Err(e) => {
                    let _ = app.emit(
                        "task:log",
                        serde_json::json!({
                            "id": task_id,
                            "line": format!("[app] Subtitle-default remux skipped: {e}"),
                            "stream": "ytdlp"
                        }),
                    );
                }
            }
        }
    }

    if !exit_ok {
        err_note = Some("yt-dlp exited with an error. Check log output for details.".to_string());
    } else if opts.burn_in_subtitles {
        if !matches!(opts.output_format, OutputFormat::Mp4) {
            let _ = app.emit(
                "task:log",
                serde_json::json!({ "id": task_id, "line": "[app] burn-in ignored (not MP4).", "stream": "ytdlp" }),
            );
        } else if opts.subtitle_lang.trim().is_empty() {
            let _ = app.emit(
                "task:log",
                serde_json::json!({ "id": task_id, "line": "[app] burn-in ignored (no subtitle language).", "stream": "ytdlp" }),
            );
        } else if !check_ffmpeg() {
            final_ok = false;
            err_note = Some(
                "ffmpeg not found. Use tools/ffmpeg/bin/ffmpeg.exe next to the app, PATH, or set FFMPEG."
                    .to_string(),
            );
        } else if last_merged.is_none() {
            final_ok = false;
            err_note = Some(
                "Burn-in failed: could not detect output MP4 path from yt-dlp log.".to_string(),
            );
        } else if merged_media_path.is_none() {
            let mp4_log = last_merged.as_ref().unwrap();
            final_ok = false;
            err_note = Some(format!(
                "Burn-in failed: merged MP4 not found at {} (and no matching .mp4 in the same folder).",
                mp4_log.display()
            ));
        } else {
            let mp4 = merged_media_path.clone().unwrap();
            let mp4_log = last_merged.clone().unwrap();
            if mp4 != mp4_log {
                let _ = app.emit(
                    "task:log",
                    serde_json::json!({
                        "id": task_id,
                        "line": format!("[app] Resolved merge output to: {}", mp4.display()),
                        "stream": "ytdlp"
                    }),
                );
            }
            let lang = opts.subtitle_lang.trim();
            match find_sidecar_srt(&mp4, lang) {
                None => {
                    final_ok = false;
                    err_note = Some(format!(
                        "Burn-in failed: no .srt next to the MP4 (looked for *.{lang}.srt and Chinese fallbacks). Ensure subtitles exist for this video or pick another language."
                    ));
                }
                Some(srt) => {
                    if pipeline_total == 4 {
                        patch_task_progress(&app, tasks, task_id, 0.0, "", "", 4, 4);
                    }
                    let app2 = app.clone();
                    let tid = task_id.to_string();
                    if let Err(e) = burn_subtitles_into_mp4(&mp4, &srt, move |ln| {
                        let _ = app2.emit(
                            "task:log",
                            serde_json::json!({ "id": tid, "line": ln, "stream": "ytdlp" }),
                        );
                    }) {
                        final_ok = false;
                        err_note = Some(e);
                    } else {
                        if pipeline_total == 4 {
                            patch_task_progress(&app, tasks, task_id, 100.0, "", "", 4, 4);
                        }
                        let _ = app.emit(
                            "task:log",
                            serde_json::json!({ "id": task_id, "line": "[app] Burn-in finished.", "stream": "ytdlp" }),
                        );
                    }
                }
            }
        }
    }

    // Only delete sidecar `.srt` after **hard burn**. Soft `--embed-subs` keeps subs in the MP4; removing
    // `.srt` breaks players that auto-load sidecars, and masks a failed embed (user still had working `.srt` before).
    if final_ok && opts.burn_in_subtitles && !opts.subtitle_lang.trim().is_empty() {
        if let Some(ref m) = merged_media_path {
            if m.extension()
                .and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("mp4"))
                .unwrap_or(false)
            {
                delete_sidecar_srts_next_to_mp4(m);
            }
        }
    }

    {
        let mut g = tasks.lock().unwrap();
        if let Some(t) = g.iter_mut().find(|x| x.id == task_id) {
            if final_ok {
                t.status = TaskStatus::Completed;
                t.progress = 100.0;
                t.download_phase = t.download_phase_total;
                t.file_path = Some(opts.download_dir.clone());
            } else {
                t.status = TaskStatus::Error;
                t.error = err_note;
            }
        }
        let snap = g.clone();
        drop(g);
        let _ = app.emit("queue:update", snap.clone());
        if let Some(t) = snap.iter().find(|x| x.id == task_id) {
            if t.status == TaskStatus::Completed {
                let title = t.title.clone().unwrap_or_else(|| "Video".to_string());
                let _ = app.emit(
                    "task:completed",
                    serde_json::json!({ "id": task_id, "title": title }),
                );
            }
        }
    }

    let _ = wake_tx.send(());
}

fn was_cancelled(tasks: &Arc<Mutex<Vec<QueueTask>>>, id: &str) -> bool {
    tasks
        .lock()
        .unwrap()
        .iter()
        .any(|t| t.id == id && t.status == TaskStatus::Cancelled)
}

fn was_cancelled_or_paused(tasks: &Arc<Mutex<Vec<QueueTask>>>, id: &str) -> bool {
    tasks.lock().unwrap().iter().any(|t| {
        t.id == id && (t.status == TaskStatus::Cancelled || t.status == TaskStatus::Paused)
    })
}

fn was_paused_after_kill(tasks: &Arc<Mutex<Vec<QueueTask>>>, id: &str) -> bool {
    tasks
        .lock()
        .unwrap()
        .iter()
        .any(|t| t.id == id && t.status == TaskStatus::Paused)
}

/// After yt-dlp exits OK on merged MP4, force phase **3** (mux done) so progress matches fixed totals.
fn snap_mp4_mux_end_after_ytdlp(
    app: &AppHandle,
    tasks: &Arc<Mutex<Vec<QueueTask>>>,
    id: &str,
    pipeline_total: u8,
) {
    let combined = (((3u8 - 1) as f64) + 1.0) / (pipeline_total as f64) * 100.0;
    let mut g = tasks.lock().unwrap();
    if let Some(t) = g.iter_mut().find(|x| x.id == id) {
        t.download_phase = 3;
        t.download_phase_total = pipeline_total;
        t.progress = combined;
    }
    let snap = g.clone();
    drop(g);
    let _ = app.emit("queue:update", snap);
}

fn fail_task(app: &AppHandle, tasks: &Arc<Mutex<Vec<QueueTask>>>, id: &str, msg: &str) {
    let mut g = tasks.lock().unwrap();
    if let Some(t) = g.iter_mut().find(|x| x.id == id) {
        t.status = TaskStatus::Error;
        t.error = Some(msg.to_string());
    }
    let _ = app.emit("queue:update", g.clone());
}

fn patch_task_progress(
    app: &AppHandle,
    tasks: &Arc<Mutex<Vec<QueueTask>>>,
    id: &str,
    raw_pct: f64,
    speed: &str,
    eta: &str,
    phase: u8,
    phase_total: u8,
) {
    let combined = if phase_total > 1 {
        (((phase - 1) as f64) + (raw_pct / 100.0)) / (phase_total as f64) * 100.0
    } else {
        raw_pct
    };
    let mut g = tasks.lock().unwrap();
    if let Some(t) = g.iter_mut().find(|x| x.id == id) {
        t.progress = combined;
        t.download_phase = phase;
        t.download_phase_total = phase_total;
        if !speed.is_empty() {
            t.speed = speed.to_string();
        }
        if !eta.is_empty() {
            t.eta = eta.to_string();
        }
    }
    let snap = g.clone();
    drop(g);
    let _ = app.emit("queue:update", snap);
    let _ = app.emit(
        "task:progress",
        serde_json::json!({
            "id": id,
            "progress": combined,
            "rawProgress": raw_pct,
            "speed": speed,
            "eta": eta,
            "downloadPhase": phase,
            "downloadPhaseTotal": phase_total,
        }),
    );
}
