import { emailConfig } from "./config";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string; contentType?: string }[]; // content = base64
}

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };
export type Sender = (mail: OutgoingEmail) => Promise<SendResult>;

// Sends through Resend's HTTP API (no SDK needed).
export const sendWithResend: Sender = async (mail) => {
  const cfg = emailConfig();
  if (!cfg.apiKey) return { ok: false, error: "email_not_configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: cfg.from,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(cfg.replyTo ? { reply_to: cfg.replyTo } : {}),
        ...(mail.attachments?.length
          ? { attachments: mail.attachments.map((a) => ({ filename: a.filename, content: a.content })) }
          : {}),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: `resend ${res.status}: ${json.message ?? "failed"}` };
    return { ok: true, id: json.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
};
