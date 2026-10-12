import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.iconfam.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private workspaces and booking links are not for search engines.
      disallow: ["/admin", "/agent", "/portal", "/api", "/book", "/set-password"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
