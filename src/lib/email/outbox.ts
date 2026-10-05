import { renderEmail, type OutboxRow } from "./templates";
import type { Sender } from "./send";

export interface ClaimedRow extends OutboxRow {
  id: string;
  to_user_id: string | null;
  to_email: string | null;
  attempts: number;
}

// The few database operations the processor needs. A real implementation lives
// in supabaseStore() (server only); tests pass an in-memory one.
export interface OutboxStore {
  claim(limit: number): Promise<ClaimedRow[]>;
  emailForUser(userId: string): Promise<string | null>;
  markSent(id: string): Promise<void>;
  markFailed(id: string, error: string, giveUp: boolean): Promise<void>;
  timezone(): Promise<string>;
}

export interface ProcessResult {
  configured: boolean;
  sent: number;
  failed: number;
  skipped: number;
}

// Sends everything that's waiting. Safe to call at any time and from several places
// at once: rows are claimed before sending, so nothing goes out twice.
export async function processOutbox(
  store: OutboxStore,
  send: Sender,
  opts: { appUrl: string; limit?: number; configured: boolean }
): Promise<ProcessResult> {
  const result: ProcessResult = { configured: opts.configured, sent: 0, failed: 0, skipped: 0 };
  // Without an email provider configured, leave the queue untouched so the
  // emails go out once it is set up.
  if (!opts.configured) return result;

  const rows = await store.claim(opts.limit ?? 25);
  if (rows.length === 0) return result;
  const timezone = await store.timezone();

  for (const row of rows) {
    try {
      const to = row.to_email ?? (row.to_user_id ? await store.emailForUser(row.to_user_id) : null);
      if (!to) {
        await store.markFailed(row.id, "no_recipient_email", true);
        result.skipped++;
        continue;
      }
      const mail = renderEmail(row, { appUrl: opts.appUrl, timezone });
      if (!mail) {
        await store.markFailed(row.id, `unknown_kind:${row.kind}`, true);
        result.skipped++;
        continue;
      }
      const res = await send({ to, ...mail });
      if (res.ok) {
        await store.markSent(row.id);
        result.sent++;
      } else {
        await store.markFailed(row.id, res.error, row.attempts >= 5);
        result.failed++;
      }
    } catch (e) {
      await store.markFailed(row.id, e instanceof Error ? e.message : "error", row.attempts >= 5).catch(() => {});
      result.failed++;
    }
  }
  return result;
}
