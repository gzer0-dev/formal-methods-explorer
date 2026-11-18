import { readFileSync } from "node:fs";

import { defineConfig, type Plugin } from "vite";

interface SiteConfig {
  title: string;
  description: string;
  url: string;
  lang: string;
  themeColor: string;
}

const site: SiteConfig = JSON.parse(readFileSync("topic.config.json", "utf8"));

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** topic.config.json を index.html・robots.txt・sitemap.xml に流し込む。 */
function siteMeta(): Plugin {
  const replacements: Record<string, string> = {
    "%SITE_TITLE%": escapeHtml(site.title),
    "%SITE_DESCRIPTION%": escapeHtml(site.description),
    "%SITE_URL%": escapeHtml(site.url),
    "%SITE_LANG%": escapeHtml(site.lang),
    "%SITE_THEME_COLOR%": escapeHtml(site.themeColor),
  };
  return {
    name: "site-meta",
    transformIndexHtml(html) {
      return Object.entries(replacements).reduce(
        (result, [placeholder, value]) => result.replaceAll(placeholder, value),
        html,
      );
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\n\nSitemap: ${site.url}sitemap.xml\n`,
      });
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          `  <url><loc>${site.url}</loc></url>\n</urlset>\n`,
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [siteMeta()],
});
