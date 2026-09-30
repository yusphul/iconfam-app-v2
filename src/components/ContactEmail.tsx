"use client";

import { useEffect, useState } from "react";

// Base64-encoded rather than written as a literal string. A plain
// character-array join (e.g. ["i","n","f","o"].join("")) still gets
// constant-folded by the production minifier back into one contiguous
// "info@iconfam.com" string in the shipped JS bundle — just as scrapable
// as putting it directly in the HTML. Base64 survives minification as an
// opaque blob that doesn't match an email-shaped pattern, and is only
// decoded (via atob) in the browser at runtime, in an effect that never
// runs during server-side rendering. This won't stop a bot that fully
// executes JavaScript and knows to hunt for base64, but that's a much
// smaller, costlier class of bot than the ones actually driving inbox spam.
const ENCODED_ADDRESS = "aW5mb0BpY29uZmFtLmNvbQ==";

function buildAddress() {
  return atob(ENCODED_ADDRESS);
}

export default function ContactEmail({
  className,
  subject,
  as = "link",
}: {
  className?: string;
  subject?: string;
  /** "link" renders a clickable mailto anchor; "text" renders plain text
   * (e.g. for the footer, where the address isn't meant to be a link). */
  as?: "link" | "text";
}) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setEmail(buildAddress());
  }, []);

  // Before hydration/mount, render nothing address-shaped at all — just a
  // neutral placeholder — so there's no window where the real string is
  // sitting in the DOM for a non-JS scraper to read.
  if (!email) {
    return (
      <span className={className} aria-hidden="true">
        &nbsp;
      </span>
    );
  }

  if (as === "text") {
    return <span className={className}>{email}</span>;
  }

  const href = subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`;

  return (
    <a href={href} className={className}>
      {email}
    </a>
  );
}
