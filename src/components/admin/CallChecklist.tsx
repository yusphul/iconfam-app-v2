"use client";

import { useEffect, useState } from "react";
import CollapsibleSection from "@/components/CollapsibleSection";

type Group = { title: string; tone: "navy" | "stamp" | "red" | "green"; items: string[] };

// The discovery-call playbook, kept in code so every admin sees the same list.
const GROUPS: Group[] = [
  {
    title: "Before the call",
    tone: "navy",
    items: [
      "Read their request on this page: summary, service, site address",
      "Have the Zoom / Meet link ready (save it under Intake call)",
    ],
  },
  {
    title: "Ask",
    tone: "stamp",
    items: [
      "What exactly do they want checked, and where?",
      "Where are they in the process? (survey, purchase agreement, C of O, Governor's consent, building approval)",
      "Which papers do they hold? (we check at the registry, no originals needed)",
      "How much have they paid already, and to whom?",
      "Is there a deadline or next payment date?",
      "Who is the seller, developer or contractor?",
      "What is their biggest worry?",
      "Is someone in Nigeria available for site access?",
    ],
  },
  {
    title: "Say",
    tone: "green",
    items: [
      "We are independent and never hold your money",
      "We report exactly what we find",
      "Property and document checks are quoted after the call",
      "Site visits and farm checks are a service fee plus field costs",
      "Full payment is made before work starts",
    ],
  },
  {
    title: "Do not",
    tone: "red",
    items: [
      "Promise a result, timeline or price",
      "Give legal advice",
      "Ask for uploads or account numbers",
    ],
  },
  {
    title: "After the call",
    tone: "navy",
    items: [
      "Fill in “What we learned on the call” and save",
      "Convert to a case and add the quote lines",
      "Pin the site location on the case",
      "After payment: assign the field agent, add milestones, assign each milestone",
      "No-show? Mark the lead and send a rebooking link",
    ],
  },
];

const TONE: Record<Group["tone"], string> = {
  navy: "text-navy",
  stamp: "text-stampDark",
  green: "text-emerald-700",
  red: "text-red-700",
};

const total = GROUPS.reduce((n, g) => n + g.items.length, 0);

export default function CallChecklist({ leadId }: { leadId: string }) {
  const key = `iconfam-call-checklist-${leadId}`;
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      setDone(raw ? JSON.parse(raw) : {});
    } catch {
      setDone({});
    }
  }, [key]);

  function persist(next: Record<string, boolean>) {
    setDone(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* private mode: ticks just stay on this screen */
    }
  }

  // "Do not" items are reminders, not tasks, so they have no tick box.
  const tickable = GROUPS.filter((g) => g.title !== "Do not").flatMap((g) => g.items);
  const count = tickable.filter((i) => done[i]).length;

  return (
    <CollapsibleSection
      title="Call checklist (internal)"
      summary={`${count} of ${tickable.length} ticked`}
      defaultOpen={false}
      actions={
        count > 0 ? (
          <button type="button" onClick={() => persist({})} className="btn btn-outline btn-sm">
            Clear ticks
          </button>
        ) : undefined
      }
    >
      <p className="mb-4 rounded-lg bg-paper px-3 py-2 text-sm text-neutral-700">
        <span className="font-semibold text-navy">Goal:</span> understand what they need checked and how far along they are. No price on the call.
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <h3 className={`mb-2 text-sm font-semibold ${TONE[g.tone]}`}>{g.title}</h3>
            <ul className="space-y-1.5">
              {g.items.map((item) =>
                g.title === "Do not" ? (
                  <li key={item} className="flex gap-2 text-sm text-neutral-700">
                    <span aria-hidden="true" className="text-red-600">✕</span>
                    {item}
                  </li>
                ) : (
                  <li key={item}>
                    <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={!!done[item]}
                        onChange={(e) => persist({ ...done, [item]: e.target.checked })}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#E8622C]"
                      />
                      <span className={done[item] ? "text-neutral-400 line-through" : ""}>{item}</span>
                    </label>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-neutral-400">Ticks are saved in this browser for this lead. {total} points in all.</p>
    </CollapsibleSection>
  );
}
