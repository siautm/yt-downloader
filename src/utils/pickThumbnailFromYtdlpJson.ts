/** yt-dlp `-J` / flat playlist entry: thumbnail may be string, `thumbnails[]` with `url`/`src`, or only on first `entries[]`. */

function isHttpUrl(s: string): boolean {
  const t = s.trim();
  return t.startsWith("http://") || t.startsWith("https://");
}

function pickFromSingleInfo(info: Record<string, unknown>): string | null {
  const thumb = info["thumbnail"];
  if (typeof thumb === "string" && isHttpUrl(thumb)) return thumb.trim();

  const picture = info["picture"];
  if (typeof picture === "string" && isHttpUrl(picture)) return picture.trim();

  const arr = info["thumbnails"];
  if (!Array.isArray(arr) || arr.length === 0) return null;

  type Th = { url?: unknown; src?: unknown; width?: unknown; height?: unknown };
  const scored: { url: string; w: number }[] = [];

  for (const el of arr) {
    if (typeof el === "string" && isHttpUrl(el)) {
      scored.push({ url: el.trim(), w: 0 });
      continue;
    }
    if (!el || typeof el !== "object") continue;
    const o = el as Th;
    const raw = o.url ?? o.src;
    if (typeof raw !== "string" || !isHttpUrl(raw)) continue;
    const w =
      typeof o.width === "number"
        ? o.width
        : typeof o.height === "number"
          ? o.height
          : 0;
    scored.push({ url: raw.trim(), w });
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.w - a.w);
  return scored[0]!.url;
}

/** Best-effort cover URL from yt-dlp JSON (YouTube, Bilibili, etc.). */
export function pickThumbnailUrlFromYtdlpJson(info: Record<string, unknown> | null): string | null {
  if (!info) return null;
  const top = pickFromSingleInfo(info);
  if (top) return top;

  const ent = info["entries"];
  if (!Array.isArray(ent) || ent.length === 0) return null;
  const first = ent[0];
  if (!first || typeof first !== "object") return null;
  return pickFromSingleInfo(first as Record<string, unknown>);
}

/** Bilibili CDNs often 403 bare `<img>` without Referer — fetch via app proxy instead. */
export function thumbnailNeedsBilibiliProxy(url: string): boolean {
  try {
    const u = new URL(url.trim());
    const h = u.hostname.toLowerCase();
    if (h.endsWith(".hdslb.com") || h === "hdslb.com") return true;
    if (h.endsWith(".biliimg.com") || h === "biliimg.com") return true;
    if (h.endsWith(".bstarstatic.com") || h === "bstarstatic.com") return true;
    return false;
  } catch {
    return false;
  }
}
