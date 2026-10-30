import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import markdownIt from "markdown-it";

const md = markdownIt({ html: true, breaks: true, linkify: true });

export default function (eleventyConfig) {
  // Statische Dateien 1:1 übernehmen
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/admin");
  eleventyConfig.addPassthroughCopy({ "src/favicon.svg": "favicon.svg" });

  // Bilder automatisch in moderne Formate (AVIF/WebP) und passende Größen umrechnen –
  // gilt auch für Bilder, die der Kunde über das CMS hochlädt.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["avif", "webp", "jpeg"],
    widths: [480, 960, 1600],
    failOnError: false,
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async" },
    },
  });

  eleventyConfig.setLibrary("md", md);
  eleventyConfig.addFilter("md", (s) => (s ? md.render(String(s)) : ""));
  eleventyConfig.addFilter("mdInline", (s) => (s ? md.renderInline(String(s)) : ""));
  eleventyConfig.addFilter("tel", (s) => "tel:" + String(s || "").replace(/[^\d+]/g, ""));
  eleventyConfig.addFilter("vorname", (s) => String(s || "").split(" ")[0]);
  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));
  // Daten einer anderen Seite holen, z. B. Tarife auf der Startseite anzeigen
  eleventyConfig.addFilter("seite", (all, url) => (all || []).find((p) => p.url === url)?.data || {});
  eleventyConfig.addShortcode("year", () => String(new Date().getFullYear()));

  eleventyConfig.addCollection("team", (api) =>
    api
      .getFilteredByGlob("src/team/*.md")
      .filter((p) => p.data.aktiv !== false)
      .sort((a, b) => (a.data.reihenfolge ?? 99) - (b.data.reihenfolge ?? 99))
  );

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
