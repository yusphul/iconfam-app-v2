import { supabaseAdmin } from "../supabaseAdmin";
import { appUrl, emailConfig } from "./config";
import { processOutbox, type ClaimedRow, type OutboxStore, type ProcessResult } from "./outbox";
import { sendWithResend } from "./send";

function supabaseStore(): OutboxStore {
  const db = supabaseAdmin();
  return {
    async claim(limit) {
      const { data, error } = await db.rpc("claim_notifications", { p_limit: limit });
      if (error) throw new Error(error.message);
      return (data as ClaimedRow[]) ?? [];
    },
    async emailForUser(userId) {
      const { data } = await db.from("users").select("email").eq("id", userId).maybeSingle();
      return (data?.email as string | null) ?? null;
    },
    async markSent(id) {
      await db.from("notification_outbox").update({ sent_at: new Date().toISOString(), last_error: null }).eq("id", id);
    },
    async markFailed(id, error, giveUp) {
      await db
        .from("notification_outbox")
        .update({ last_error: error.slice(0, 500), ...(giveUp ? { attempts: 5 } : {}) })
        .eq("id", id);
    },
    async timezone() {
      const { data } = await db.from("booking_settings").select("timezone").maybeSingle();
      return (data?.timezone as string | undefined) ?? "America/Chicago";
    },
  };
}

// Used by the API routes: send whatever is waiting.
export async function runOutbox(origin?: string, limit = 25): Promise<ProcessResult> {
  const configured = Boolean(emailConfig().apiKey);
  return processOutbox(supabaseStore(), sendWithResend, { appUrl: appUrl(origin), limit, configured });
}
