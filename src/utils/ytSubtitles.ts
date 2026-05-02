/** yt-dlp `-J` root keys for caption tracks */
const LIVE_CHAT = "live_chat";

function langKeysFromTracks(obj: unknown): string[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.keys(obj as Record<string, unknown>).filter(
    (k) => k.length > 0 && k !== LIVE_CHAT,
  );
}

export interface SubtitleAvailability {
  /** Human / broadcast captions (`subtitles` in JSON). */
  manual: string[];
  /** Auto-generated (`automatic_captions`). */
  auto: string[];
}

function uniqSorted(codes: string[]): string[] {
  return [...new Set(codes)].sort((a, b) => a.localeCompare(b, "en"));
}

function normCode(code: string): string {
  return code.trim().toLowerCase().replace(/_/g, "-");
}

/** en, en-US, en-orig, … */
export function isPrimaryEnglish(code: string): boolean {
  const c = normCode(code);
  return c === "en" || c.startsWith("en-") || c.startsWith("en.");
}

/** Simplified Mandarin / mainland-style codes; excludes Traditional, TW/HK/MO, Cantonese. */
export function isPrimaryMandarinChinese(code: string): boolean {
  const c = normCode(code);
  if (c.startsWith("zh-hant")) return false;
  if (c === "zh-tw" || c === "zh-hk" || c === "zh-mo") return false;
  if (c.startsWith("zh-tw-") || c.startsWith("zh-hk-") || c.startsWith("zh-mo-")) return false;
  if (c === "yue" || c.startsWith("yue-")) return false;
  if (c === "zh-hans" || c === "zh-cn" || c === "cmn") return true;
  if (c.startsWith("zh-hans-") || c.startsWith("zh-cn-")) return true;
  if (c === "zh") return true;
  return false;
}

/** ja, ja-JP, … */
export function isPrimaryJapanese(code: string): boolean {
  const c = normCode(code);
  return c === "ja" || c.startsWith("ja-") || c.startsWith("ja.");
}

export interface GroupedSubtitleCodes {
  english: string[];
  mandarin: string[];
  japanese: string[];
  /** Everything not in the three groups above (e.g. zh-TW, ko, es). */
  other: string[];
}

/** Split flat language keys into EN / Mandarin (简体系) / JP / other. */
export function groupPrimarySubtitleCodes(codes: string[]): GroupedSubtitleCodes {
  const english: string[] = [];
  const mandarin: string[] = [];
  const japanese: string[] = [];
  const other: string[] = [];
  for (const code of codes) {
    if (isPrimaryEnglish(code)) english.push(code);
    else if (isPrimaryMandarinChinese(code)) mandarin.push(code);
    else if (isPrimaryJapanese(code)) japanese.push(code);
    else other.push(code);
  }
  return {
    english: uniqSorted(english),
    mandarin: uniqSorted(mandarin),
    japanese: uniqSorted(japanese),
    other: uniqSorted(other),
  };
}

export function mergeSubtitleCodeKeys(av: SubtitleAvailability): string[] {
  return uniqSorted([...av.manual, ...av.auto]);
}

/** Read which subtitle languages yt-dlp reported for this extractor result. */
export function extractSubtitleLanguages(info: Record<string, unknown> | null): SubtitleAvailability {
  if (!info) return { manual: [], auto: [] };
  const manual = langKeysFromTracks(info["subtitles"]);
  const auto = langKeysFromTracks(info["automatic_captions"]);
  return { manual: uniqSorted(manual), auto: uniqSorted(auto) };
}

/** Single-select: click same code again to clear; click another to switch. */
export function pickToggleSubtitleLang(current: string, code: string): string {
  const a = current.trim().toLowerCase();
  const b = code.trim().toLowerCase();
  if (!b) return "";
  if (a === b) return "";
  return code.trim();
}
