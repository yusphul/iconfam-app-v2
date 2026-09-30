import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // These names are kept from the original build, but the values now match
        // the light blueprint/survey palette used on the gateway/login screens —
        // this reskins the admin, agent, and client portal to the new look without
        // touching every className across those pages.
        navy: "#101828",
        stamp: "#E8622C",
        stampDark: "#C94F1D",
        verified: "#3DBD8C",
        paper: "#FBFCFD",
        line: "#E4E9EF",
        // New palette — used by the role-gateway landing page, login, and set-password
        // screens. Deliberately separate from the tokens above so the admin/agent/
        // client app screens are untouched. Light theme: "blueprint" is the light
        // background, "chalk" is the dark text — kept as names so no component
        // classNames need to change if the palette shifts again.
        blueprint: "#FBFCFD",
        blueprintLine: "#E4E9EF",
        chalk: "#101828",
        slateSoft: "#64748B",
        survey: "#E8622C",
        surveyLight: "#C94F1D",
        benchmark: "#3DBD8C",
        sectionTint: "#EEF2F6",
        // Dedicated dark footer palette — the original dark blueprint navy from
        // before the light-theme redesign, kept on hand specifically for this.
        footerBg: "#0F2438",
        footerLine: "#2C4A63",
        footerText: "#E7EDF3",
        footerTextSoft: "#8FA3B8",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
    },
  },
  plugins: [],
};
export default config;
