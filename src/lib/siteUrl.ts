// Turns whatever is in NEXT_PUBLIC_SITE_URL into a valid absolute URL string without a trailing slash.
// Accepts "iconfam.com", "www.iconfam.com/" and "https://www.iconfam.com"; falls back if it is junk.
export function normalizeSiteUrl(raw: string | undefined | null, fallback = "https://www.iconfam.com"): string {
  const v = (raw ?? "").trim();
  if (!v) return fallback;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return fallback;
  }
}
