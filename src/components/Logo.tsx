import Image from "next/image";

// Real dimensions of the source files in /public — used to keep the aspect
// ratio correct at any requested height.
const ASPECT = {
  compact: 500 / 96, // icon + "iConfam" wordmark, no tagline — most contexts
  full: 500 / 122, // icon + wordmark + "Verify. Invest. Build with Confidence."
};

export default function Logo({
  variant = "compact",
  theme = "dark",
  height = 32,
  className = "",
}: {
  variant?: "compact" | "full";
  // "dark" = navy text, for light backgrounds (most places).
  // "light" = the navy swapped for a soft off-white, for dark backgrounds
  // (the footer) — the source logo's navy text would otherwise nearly
  // disappear against the footer's own dark navy.
  theme?: "dark" | "light";
  height?: number;
  className?: string;
}) {
  const width = Math.round(height * ASPECT[variant]);
  const file = `/logo-${variant}${theme === "light" ? "-light" : ""}.png`;
  return (
    <Image
      src={file}
      alt="iConfam — Verify. Invest. Build with Confidence."
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}
