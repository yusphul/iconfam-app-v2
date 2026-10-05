import { createClient } from "@supabase/supabase-js";

// Security note: this client uses the public "anon" key. It is safe to ship to the
// browser because every table has Row Level Security enabled (see
// supabase/migrations/0001_init_schema.sql) — the anon key alone cannot read or write
// anything the signed-in user's role isn't allowed to touch. Never put the service
// role key in this file or any file that ships to the browser.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Emails are queued by the database whenever something happens (a booking, a
// payment, a report...). After any successful write from the browser we ask the
// server, once, a moment later, to send what's waiting. Debounced so a burst of
// writes causes a single request; failures are ignored because a daily job also
// sends anything left in the queue.
const WRITING_RPCS = ["book_lead_call", "cancel_lead_call", "report_payment", "convert_lead"];
let kickTimer: ReturnType<typeof setTimeout> | undefined;
function kickNotifications() {
  if (typeof window === "undefined" || kickTimer) return;
  kickTimer = setTimeout(() => {
    kickTimer = undefined;
    fetch("/api/notifications/process", { method: "POST", keepalive: true }).catch(() => {});
  }, 1500);
}

const fetchAndNotify: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET" && method !== "HEAD" && res.ok) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/rest/v1/rpc/")) {
      // RPCs are POSTs even when they only read, so only the ones that write count.
      if (WRITING_RPCS.some((n) => url.includes(`/rpc/${n}`))) kickNotifications();
    } else if (url.includes("/rest/v1/")) {
      kickNotifications();
    }
  }
  return res;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchAndNotify },
});
