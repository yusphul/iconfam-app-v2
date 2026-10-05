// Email settings, all from environment variables so nothing secret is in the code.
//
//   RESEND_API_KEY   from resend.com. Without it the app still works; emails simply wait in the queue.
//   EMAIL_FROM       e.g. "iConfam <hello@iconfam.com>" (the domain must be verified in Resend)
//   EMAIL_REPLY_TO   optional, where replies go
//   NEXT_PUBLIC_SITE_URL   e.g. https://app.iconfam.com, used for the links inside emails

export interface EmailConfig {
  apiKey: string | null;
  from: string;
  replyTo: string | null;
}

export function emailConfig(): EmailConfig {
  return {
    apiKey: process.env.RESEND_API_KEY || null,
    from: process.env.EMAIL_FROM || "iConfam <onboarding@resend.dev>",
    replyTo: process.env.EMAIL_REPLY_TO || null,
  };
}

export function appUrl(fallbackOrigin?: string): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    fallbackOrigin ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
