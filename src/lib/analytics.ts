// Thin wrapper over Meta Pixel and Google Analytics 4. It does nothing unless the
// visitor accepted tracking and the IDs are set, so it is always safe to call.

export type TrackEvent = "request_started" | "request_submitted" | "call_booked" | "whatsapp_click";

type Fbq = (...args: unknown[]) => void;
type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
    gtag?: Gtag;
  }
}

// What each event is called in Meta and in Google. Meta's standard names
// (Lead, Schedule, Contact) let ad campaigns optimise for them.
const META: Record<TrackEvent, { standard: boolean; name: string }> = {
  request_started: { standard: false, name: "RequestStarted" },
  request_submitted: { standard: true, name: "Lead" },
  call_booked: { standard: true, name: "Schedule" },
  whatsapp_click: { standard: true, name: "Contact" },
};
const GOOGLE: Record<TrackEvent, string> = {
  request_started: "request_started",
  request_submitted: "generate_lead",
  call_booked: "call_booked",
  whatsapp_click: "whatsapp_click",
};

export function track(event: TrackEvent, params: Record<string, string | number | boolean> = {}) {
  if (typeof window === "undefined") return;
  try {
    const m = META[event];
    window.fbq?.(m.standard ? "track" : "trackCustom", m.name, params);
    window.gtag?.("event", GOOGLE[event], params);
  } catch {
    // Tracking must never break the page.
  }
}
