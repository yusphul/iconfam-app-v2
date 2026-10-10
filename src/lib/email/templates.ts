// Every email the app sends. One function per kind returns a subject, a short
// message and one button; layout() wraps them in the branded shell. All text from
// users is escaped. Plain-text twins are generated alongside the HTML.

import { buildIcs } from "../calendar";

export interface OutboxRow {
  kind: string;
  to_name: string | null;
  payload: Record<string, unknown>;
}

export interface RenderContext {
  appUrl: string;
  timezone: string; // the team's time zone, used to show call times
}

export interface Rendered {
  subject: string;
  html: string;
  text: string;
  attachments?: { filename: string; content: string; contentType: string }[];
}

const NAVY = "#101828";
const STAMP = "#E8622C";

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SERVICE: Record<string, string> = {
  property_purchase: "Property purchase",
  ground_up_build: "Ground-up build",
  farm_oversight: "Farm / agribusiness",
  status_verification: "Status verification",
};
const VERDICT: Record<string, string> = {
  proceed: "Proceed",
  proceed_with_caution: "Proceed with caution",
  do_not_proceed: "Do not proceed",
  inconclusive: "Inconclusive",
};
const CASE_STATUS: Record<string, string> = {
  in_progress: "Work has started on your case",
  report_delivered: "Your final report is ready",
  on_hold: "Your case has been put on hold",
};

const money = (cur: unknown, n: unknown) => `${cur} ${Number(n).toLocaleString("en-US")}`;

function when(ctx: RenderContext, iso: unknown, minutes?: unknown): string {
  const d = new Date(String(iso));
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: ctx.timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: ctx.timezone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
  return `${date} at ${time}${minutes ? ` (${minutes} minutes)` : ""}`;
}

interface Body {
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  facts?: [string, string][];
  cta?: { label: string; url: string };
  note?: string;
  attachments?: Rendered["attachments"];
}

function layout(b: Body, ctx: RenderContext, name: string | null): Rendered {
  const greeting = name ? `Hi ${esc(name.split(" ")[0])},` : "Hello,";
  const facts = (b.facts ?? [])
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#667085;font-size:14px;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;color:${NAVY};font-size:14px;font-weight:600">${esc(v)}</td></tr>`
    )
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#F2F5F8;font-family:Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(b.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F5F8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E4E9EF">
<tr><td style="background:${NAVY};padding:18px 28px"><img src="${esc(ctx.appUrl)}/logo-compact-light.png" alt="iConfam" height="26" style="display:block;border:0;height:26px"></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:${NAVY}">${esc(b.heading)}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#344054">${greeting}</p>
${b.paragraphs.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#344054">${esc(p)}</p>`).join("")}
${facts ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;border-top:1px solid #E4E9EF;border-bottom:1px solid #E4E9EF;width:100%">${facts}</table>` : ""}
${b.cta ? `<p style="margin:20px 0"><a href="${esc(b.cta.url)}" style="background:${STAMP};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 24px;border-radius:999px;display:inline-block">${esc(b.cta.label)}</a></p><p style="margin:0 0 12px;font-size:12px;color:#667085;word-break:break-all">Or copy this link: ${esc(b.cta.url)}</p>` : ""}
${b.note ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#667085">${esc(b.note)}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;background:#F8FAFC;border-top:1px solid #E4E9EF;font-size:12px;line-height:1.5;color:#667085">iConfam. Independent verification before your money moves.<br>You are receiving this because of activity on your iConfam request or account.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    b.heading,
    "",
    name ? `Hi ${name.split(" ")[0]},` : "Hello,",
    "",
    ...b.paragraphs.flatMap((p) => [p, ""]),
    ...(b.facts ?? []).map(([k, v]) => `${k}: ${v}`),
    ...(b.facts?.length ? [""] : []),
    ...(b.cta ? [`${b.cta.label}: ${b.cta.url}`, ""] : []),
    ...(b.note ? [b.note, ""] : []),
    "iConfam. Independent verification before your money moves.",
  ].join("\n");

  return { subject: b.subject, html, text, attachments: b.attachments };
}

function icsFor(p: Record<string, unknown>, ctx: RenderContext) {
  const ev = {
    title: "iConfam intake call",
    start: new Date(String(p.call_at)),
    minutes: Number(p.call_minutes),
    uid: String(p.token ?? p.lead_id ?? "call"),
    description: `A ${p.call_minutes}-minute call with the iConfam team about: ${p.summary}.` +
      (p.call_link ? `\nJoin: ${p.call_link}` : ""),
    location: p.call_link ? String(p.call_link) : undefined,
  };
  return [
    {
      filename: "iconfam-intake-call.ics",
      content: Buffer.from(buildIcs(ev), "utf8").toString("base64"),
      contentType: "text/calendar",
    },
  ];
}

export function renderEmail(row: OutboxRow, ctx: RenderContext): Rendered | null {
  const p = row.payload ?? {};
  const u = (path: string) => `${ctx.appUrl}${path}`;
  const caseTitle = String(p.case_title ?? "your case");
  const portalCase = u(`/portal/cases/${p.case_id}`);
  const staffCase = u(`/agent/cases/${p.case_id}`);
  const service = SERVICE[String(p.service ?? p.case_type)] ?? "";
  const booking = u(`/book/${p.token}`);

  let b: Body;
  switch (row.kind) {
    // ---------- visitor / client ----------
    case "lead_received":
      b = {
        subject: "We got your request. Pick a time to talk",
        preheader: "Book a short call so we can understand what you need.",
        heading: "We received your request",
        paragraphs: [
          `Thanks for getting in touch about: ${p.summary}.`,
          "The next step is a short call (30 or 60 minutes) so we understand where you are and what you want to achieve. Nothing is charged on this call.",
        ],
        cta: { label: "Book your call", url: booking },
        note: "If you already picked a time, you can ignore this email.",
      };
      break;
    case "call_booked":
    case "call_rescheduled":
    case "call_reminder": {
      const headings: Record<string, [string, string]> = {
        call_booked: ["Your call is booked", "Your iConfam call is booked"],
        call_rescheduled: ["Your call has been moved", "Your iConfam call has a new time"],
        call_reminder: ["Your call is coming up", "Reminder: your iConfam call is coming up"],
      };
      const [heading, subject] = headings[row.kind];
      b = {
        subject,
        preheader: when(ctx, p.call_at, p.call_minutes),
        heading,
        paragraphs: [
          row.kind === "call_rescheduled"
            ? "We've updated your call to the new time below."
            : "A short call so we understand where you are and what you want to achieve.",
          "Have any documents you already hold to hand (survey plan, deed, receipts) and your deadline, if you have one.",
        ],
        facts: [
          ["When", when(ctx, p.call_at, p.call_minutes)],
          ["About", String(p.summary ?? "")],
          ["Join", p.call_link ? String(p.call_link) : "We'll send the video link before the call"],
        ],
        cta: { label: "View or change your booking", url: booking },
        note: "A calendar file is attached. Times above are shown in the team's time zone; your calendar will convert it to yours.",
        attachments: row.kind === "call_reminder" ? undefined : icsFor(p, ctx),
      };
      break;
    }
    case "call_cancelled":
      b = {
        subject: "Your iConfam call was cancelled",
        preheader: "You can book another time whenever you're ready.",
        heading: "Your call was cancelled",
        paragraphs: ["Your call has been cancelled. You can pick a new time whenever you're ready."],
        cta: { label: "Book a new time", url: booking },
      };
      break;
    case "quote_ready": {
      const full = Number(p.deposit_percent) >= 100;
      b = {
        subject: "Your iConfam quote is ready",
        preheader: full ? `Payment due: ${money(p.currency, p.total)}` : `Deposit due: ${money(p.currency, p.deposit)}`,
        heading: "Your quote is ready",
        paragraphs: [
          `Thank you for speaking with us. We've set up "${caseTitle}" for you.`,
          full
            ? "We begin work as soon as your payment is received. This is the full fee for this case, so nothing more is charged."
            : "We begin work as soon as your initial deposit is received. Nothing else is charged until then.",
        ],
        facts: full
          ? [["Total fee, due now", money(p.currency, p.total)]]
          : [
              ["Total fee", money(p.currency, p.total)],
              ["Initial deposit", `${money(p.currency, p.deposit)} (${p.deposit_percent}%)`],
            ],
        cta: { label: full ? "View quote and pay" : "View quote and pay deposit", url: portalCase },
      };
      break;
    }
    case "payment_received": {
      const dep = p.kind === "deposit" && !p.full_prepay;
      const forWhat = p.kind === "deposit" && p.full_prepay ? "Payment in full" : String(p.description ?? "");
      b = {
        subject: dep ? "Deposit received. Thank you" : "Payment received. Thank you",
        preheader: `${money(p.currency, p.amount)} received for ${caseTitle}`,
        heading: dep ? "We've received your deposit" : "We've received your payment",
        paragraphs: [
          p.kind === "deposit"
            ? "Thank you. We're assigning our team and the milestone(s) will appear in your portal."
            : "Thank you. Your payment has been confirmed.",
        ],
        facts: [
          ["Case", caseTitle],
          ["For", forWhat],
          ["Amount", money(p.currency, p.amount)],
        ],
        cta: { label: "Open your case", url: portalCase },
      };
      break;
    }
    case "report_shared": {
      const doc = p.item === "document";
      b = {
        subject: `New ${doc ? "document" : "report"} on your case: ${caseTitle}`,
        preheader: `Your verification team shared a ${doc ? "document" : "report"}.`,
        heading: `A new ${doc ? "document" : "report"} is ready`,
        paragraphs: [
          `Your verification team has shared a new ${doc ? `document${p.doc_type ? ` (${p.doc_type})` : ""}` : "report"} on "${caseTitle}".`,
        ],
        cta: { label: "Read it in your portal", url: portalCase },
      };
      break;
    }
    case "recommendation_published":
      b = {
        subject: `Our recommendation for ${caseTitle}`,
        preheader: `Our recommendation: ${VERDICT[String(p.verdict)] ?? ""}`,
        heading: "Our recommendation is ready",
        paragraphs: [
          `We've published our recommendation for "${caseTitle}": ${VERDICT[String(p.verdict)] ?? "see your portal"}.`,
          "Open your case for the plain-language summary and what we suggest you do next.",
        ],
        cta: { label: "Read our recommendation", url: portalCase },
        note: "This is our independent assessment to help you decide. It is not legal or financial advice.",
      };
      break;
    case "step_update": {
      const issue = p.status === "issue_found";
      b = {
        subject: issue ? `A finding on your case: ${caseTitle}` : `Step verified: ${p.step}`,
        preheader: `${p.step}: ${issue ? "issue found" : "confirmed"}`,
        heading: issue ? "We found something to look at" : "A step has been verified",
        paragraphs: [
          issue
            ? `While checking "${p.step}" on "${caseTitle}", we found an issue. Open your case to see what it is.`
            : `"${p.step}" on "${caseTitle}" has been confirmed.`,
        ],
        cta: { label: "Open your case", url: portalCase },
      };
      break;
    }
    case "case_status":
      b = {
        subject: `${CASE_STATUS[String(p.status)] ?? "Your case was updated"}: ${caseTitle}`,
        preheader: caseTitle,
        heading: CASE_STATUS[String(p.status)] ?? "Your case was updated",
        paragraphs: [`Update on "${caseTitle}".`],
        cta: { label: "Open your case", url: portalCase },
      };
      break;
    case "new_message": {
      const toStaff = p.to_role === "agent" || p.to_role === "professional";
      b = {
        subject: `New message about ${caseTitle}`,
        preheader: "You have a new message from the iConfam team.",
        heading: "You have a new message",
        paragraphs: [`The iConfam team sent you a message about "${caseTitle}". For privacy, we don't put messages in emails.`],
        cta: { label: "Read the message", url: toStaff ? staffCase : portalCase },
      };
      break;
    }
    case "assigned_to_case":
      b = {
        subject: `You've been assigned to a case: ${caseTitle}`,
        preheader: service,
        heading: "You've been assigned to a case",
        paragraphs: [
          `You are now ${p.role === "professional" ? `the ${String(p.specialty ?? "professional").replace(/_/g, " ")}` : "the field agent"} on "${caseTitle}".`,
        ],
        facts: [["Type", service], ["Case", caseTitle]],
        cta: { label: "Open the case", url: staffCase },
      };
      break;

    // ---------- admins ----------
    case "admin_new_lead":
      b = {
        subject: `New lead: ${p.name}, ${p.summary}`,
        preheader: service,
        heading: "New lead",
        paragraphs: ["Someone has shown interest. They will pick a time for an intake call."],
        facts: [["Name", String(p.name)], ["Email", String(p.email)], ["Phone", String(p.phone ?? "")], ["Service", service], ["About", String(p.summary)]],
        cta: { label: "Open the lead", url: u(`/admin/leads/${p.lead_id}`) },
      };
      break;
    case "admin_call_booked":
    case "admin_call_rescheduled":
    case "admin_call_cancelled": {
      const what = row.kind.replace("admin_call_", "");
      b = {
        subject: `Call ${what}: ${p.name}`,
        preheader: p.call_at ? when(ctx, p.call_at, p.call_minutes) : "",
        heading: `Intake call ${what}`,
        paragraphs: [`${p.name} ${what === "booked" ? "booked" : what === "rescheduled" ? "moved" : "cancelled"} their intake call.`],
        facts: [
          ...(what === "cancelled" ? [] : ([["When", when(ctx, p.call_at, p.call_minutes)]] as [string, string][])),
          ["About", String(p.summary)],
          ["Email", String(p.email)],
        ],
        cta: { label: "Open the lead", url: u(`/admin/leads/${p.lead_id}`) },
        attachments: what === "cancelled" ? undefined : icsFor(p, ctx),
      };
      break;
    }
    case "admin_payment_reported":
      b = {
        subject: `Payment reported: ${caseTitle}`,
        preheader: `${money(p.currency, p.amount)} via ${p.method}`,
        heading: "A client says they've paid",
        paragraphs: ["Check your bank for the transfer, then confirm it on the case. Work stays locked until the first payment is confirmed."],
        facts: [
          ["Case", caseTitle],
          ["For", String(p.description)],
          ["Amount", money(p.currency, p.amount)],
          ...(p.method === "bank_ngn" ? ([["Naira to expect", `NGN ${Number(p.ngn_amount).toLocaleString("en-US")} at ${p.fx_rate} per USD`]] as [string, string][]) : []),
          ...(p.reference ? ([["Reference", String(p.reference)]] as [string, string][]) : []),
          ["Receipt", p.has_receipt ? "Attached on the case" : "None uploaded"],
        ],
        cta: { label: "Confirm on the case", url: u(`/admin/cases/${p.case_id}`) },
      };
      break;
    case "admin_review_needed":
      b = {
        subject: `Needs your review: ${p.item} on ${caseTitle}`,
        preheader: `From ${p.from}`,
        heading: `A ${p.item} is waiting for review`,
        paragraphs: [`${p.from} submitted a ${p.item} on "${caseTitle}". Clients only see it after you approve and share it.`],
        cta: { label: "Open the review queue", url: u("/admin/reports") },
      };
      break;
    case "admin_new_message":
      b = {
        subject: `New message on ${caseTitle}`,
        preheader: `From ${p.from}`,
        heading: "New message",
        paragraphs: [`${p.from} sent a message on "${caseTitle}".`],
        cta: { label: "Open the case", url: u(`/admin/cases/${p.case_id}`) },
      };
      break;

    // ---------- account ----------
    case "invite":
      b = {
        subject: p.role === "client" ? "Your iConfam account is ready" : "You've been invited to iConfam",
        preheader: "Set your password to get started.",
        heading: p.role === "client" ? "Your iConfam account is ready" : "Welcome to the iConfam team",
        paragraphs: [
          p.role === "client"
            ? "We've created your account so you can follow your verification, see reports and pay securely."
            : `You've been added as ${p.role === "agent" ? "a field agent" : p.role === "professional" ? "a professional" : "an admin"}.`,
          "Set your password to get started. This link works once and expires after a short time.",
        ],
        cta: { label: "Set your password", url: String(p.link) },
        note: "If you weren't expecting this, you can ignore this email.",
      };
      break;
    default:
      return null;
  }
  return layout(b, ctx, row.to_name);
}
