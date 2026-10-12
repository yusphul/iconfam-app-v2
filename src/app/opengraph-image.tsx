import { ImageResponse } from "next/og";

export const alt = "iConfam: independent verification before your money moves";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The picture shown when the link is shared on WhatsApp, Facebook, X and in ads.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0F2438",
          color: "#FFFFFF",
          padding: "64px 72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 700 }}>
          <div style={{ width: 16, height: 16, borderRadius: 8, background: "#E8622C" }} />
          iConfam
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>
          <div>Before you send</div>
          <div>that money home,</div>
          <div style={{ color: "#E8622C" }}>confam am.</div>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#8FA3B8" }}>
          Independent checks on property, builds and farms in Nigeria
        </div>
      </div>
    ),
    size
  );
}
