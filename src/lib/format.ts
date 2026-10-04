/** "just now", "5m ago", "3h ago", "2d ago", else a plain date. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Advisory only: spots text that looks like someone trying to move a
 * conversation off-platform (phone number, email, WhatsApp/Telegram, a link).
 * Shown to the admin during review as a nudge to look closer — it never
 * blocks anything, and is easy to evade, so it complements the real controls
 * (private message threads and the review gate) rather than replacing them.
 */
export function detectContactInfo(text: string | null | undefined): string[] {
  if (!text) return [];
  const hits: string[] = [];
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(text)) hits.push("an email address");
  if (/(?:\+?\d[\s().-]?){9,}/.test(text)) hits.push("what looks like a phone number");
  if (/wa\.me|whats\s?app|telegram|t\.me\//i.test(text)) hits.push("a WhatsApp/Telegram reference");
  if (/https?:\/\/|www\./i.test(text)) hits.push("a web link");
  return hits;
}
