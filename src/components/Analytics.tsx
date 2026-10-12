"use client";

import Script from "next/script";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const KEY = "iconfam-tracking-consent";

// Private areas are never tracked.
const PRIVATE = ["/admin", "/agent", "/portal", "/api"];

type Choice = "unknown" | "granted" | "denied";

// Loads Meta Pixel and Google Analytics only after the visitor says yes, and only
// when the IDs are set in the environment. With no IDs this renders nothing at all
// (no scripts, no banner), so it is safe to ship before ads are ready.
export default function Analytics() {
  const pathname = usePathname();
  const [choice, setChoice] = useState<Choice>("unknown");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === "granted" || v === "denied") setChoice(v);
    } catch {
      // Storage blocked: treat as undecided, no tracking.
    }
    setReady(true);
  }, []);

  // One page view per page the visitor opens (the app navigates without reloading).
  useEffect(() => {
    if (choice !== "granted" || !pathname || PRIVATE.some((p) => pathname.startsWith(p))) return;
    window.fbq?.("track", "PageView");
    window.gtag?.("event", "page_view", { page_path: pathname });
  }, [choice, pathname]);

  if (!PIXEL_ID && !GA_ID) return null;
  if (!pathname || PRIVATE.some((p) => pathname.startsWith(p))) return null;

  function decide(next: "granted" | "denied") {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // ignore
    }
    setChoice(next);
  }

  return (
    <>
      {choice === "granted" && PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','${PIXEL_ID}');
        `}</Script>
      )}
      {choice === "granted" && GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`
            window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;
            gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});
          `}</Script>
        </>
      )}

      {ready && choice === "unknown" && (
        <div
          role="dialog"
          aria-label="Cookie choices"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-blueprintLine bg-white p-4 shadow-xl sm:p-5"
        >
          <p className="text-sm leading-relaxed text-chalk">
            We use cookies from Meta and Google to see which ads bring people to iConfam. They never
            see your documents or your case. Allow them?{" "}
            <Link href="/policies#privacy" className="font-medium text-survey underline-offset-2 hover:underline">
              Privacy
            </Link>
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => decide("granted")} className="btn-primary btn-sm">
              Allow
            </button>
            <button type="button" onClick={() => decide("denied")} className="btn-outline btn-sm">
              No thanks
            </button>
          </div>
        </div>
      )}
    </>
  );
}
