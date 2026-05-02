/** Heights present in yt-dlp `-J` formats (video streams only). */
export function extractAvailableHeights(info: Record<string, unknown> | null): number[] {
  if (!info) return [];
  const heights = new Set<number>();

  const rootH = info["height"];
  if (typeof rootH === "number" && rootH > 0) {
    const vc = info["vcodec"];
    if (typeof vc === "string" && vc !== "none") heights.add(rootH);
  }

  const formats = info["formats"];
  if (Array.isArray(formats)) {
    for (const f of formats) {
      if (!f || typeof f !== "object") continue;
      const row = f as Record<string, unknown>;
      const h = row["height"];
      const vc = row["vcodec"];
      if (typeof h === "number" && h > 0 && typeof vc === "string" && vc !== "none") {
        heights.add(h);
      }
    }
  }

  return [...heights].sort((a, b) => a - b);
}

export function maxVideoHeight(info: Record<string, unknown> | null): number | null {
  const hs = extractAvailableHeights(info);
  if (!hs.length) return null;
  return hs[hs.length - 1]!;
}

/** Clip field placeholders aligned to total duration (e.g. 06:28 for 6m28s). */
export function formatClipDurationPlaceholder(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
