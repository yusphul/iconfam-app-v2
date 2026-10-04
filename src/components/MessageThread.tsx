"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { CaseMessage } from "@/lib/types";

// One private conversation on a case. Every message belongs to a "thread",
// identified by the non-admin person it is with:
//   - the client's thread:        client  <-> admin team
//   - a professional's thread:    that professional <-> admin team
//   - a field agent's thread:     that agent <-> admin team
// The database only ever returns a person their own thread (admins see all),
// so a professional can't read or write to the client — and the other way
// round — which is what stops contact details being passed around the
// business. See supabase/migrations/0005.

export default function MessageThread({
  caseId,
  threadUserId,
  currentUserId,
  labelFor,
  placeholder = "Write a message…",
  emptyText = "No messages yet.",
}: {
  caseId: string;
  threadUserId: string;
  currentUserId: string;
  /** Display name for a sender. Admins see real names; everyone else sees roles. */
  labelFor: (senderId: string) => string;
  placeholder?: string;
  emptyText?: string;
}) {
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("case_id", caseId)
      .eq("thread_user_id", threadUserId)
      .order("sent_at");
    setMessages((data as CaseMessage[]) ?? []);
  }, [caseId, threadUserId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const { error: err } = await supabase.from("messages").insert({
      case_id: caseId,
      sender_id: currentUserId,
      thread_user_id: threadUserId,
      channel: "portal",
      body,
    });
    setSending(false);
    if (err) {
      setError("Couldn't send that — please try again.");
      return;
    }
    setDraft("");
    load();
  }

  return (
    <div>
      <div className="mb-3 max-h-64 space-y-2 overflow-y-auto">
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div
              key={m.id}
              className={`rounded border p-2 text-sm ${
                mine ? "ml-8 border-blue-100 bg-blue-50/60" : "mr-8 border-line bg-paper"
              }`}
            >
              <div className="mb-0.5 text-xs font-semibold text-navy">
                {mine ? "You" : labelFor(m.sender_id)}
              </div>
              <div className="whitespace-pre-wrap">{m.body}</div>
              <div className="mt-0.5 text-xs text-neutral-400">
                {new Date(m.sent_at).toLocaleString()}
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <p className="text-sm text-neutral-400">{emptyText}</p>}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded border border-line bg-white px-3 py-2 text-sm"
        />
        <button
          onClick={send}
          disabled={sending}
          className="rounded bg-stamp px-4 py-2 text-sm font-medium text-white hover:bg-stampDark disabled:opacity-60"
        >
          Send
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
