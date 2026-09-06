/**
 * AZEXAI SEO ENGINE
 * ---------------------------------------------------------
 * Purpose:
 * - Audit the generated AZEXAI website
 * - Generate sitemap.xml
 * - Generate RSS feed
 * - Validate robots.txt
 * - Validate canonical URLs
 * - Validate Open Graph / Twitter metadata
 * - Validate JSON-LD structured data
 * - Validate article titles/descriptions
 * - Detect missing images / alt attributes
 * - Detect weak internal linking
 * - Generate seo-report.json
 *
 * Requirements:
 * - Node.js 18+
 * - SITE_ORIGIN environment variable (optional)
 *
 * Default:
 * https://azexai.com
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();

const SITE_ORIGIN = (
  process.env.SITE_ORIGIN ||
  "https://azexai.com"
).replace(/\/+$/, "");

const ARTICLE_DIR = path.join(ROOT, "article");
const OUTPUT_DIR = ROOT;

const REPORT_FILE = path.join(OUTPUT_DIR, "seo-report.json");
const SITEMAP_FILE = path.join(OUTPUT_DIR, "sitemap.xml");
const RSS_FILE = path.join(OUTPUT_DIR, "rss.xml");
const FEED_FILE = path.join(OUTPUT_DIR, "feed.xml");
const ROBOTS_FILE = path.join(OUTPUT_DIR, "robots.txt");

const STATIC_PAGES = [
  "/",
  "/contact/",
];

const MAX_DESCRIPTION_LENGTH = 170;
const MIN_DESCRIPTION_LENGTH = 70;
const MIN_TITLE_LENGTH = 25;
const MAX_TITLE_LENGTH = 65;

const errors = [];
const warnings = [];
const passed = [];
const info = [];

function addError(code, message, file = "") {
  errors.push({ code, message, file });
}

function addWarning(code, message, file = "") {
  warnings.push({ code, message, file });
}

function addPassed(code, message, file = "") {
  passed.push({ code, message, file });
}

function addInfo(code, message, file = "") {
  info.push({ code, message, file });
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(html = "") {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(url) {
  try {
    return new URL(url, SITE_ORIGIN).href;
  } catch {
    return "";
  }
}

function getFilesRecursively(directory) {
  if (!fs.existsSync(directory)) return [];

  const result = [];

  for (const item of fs.readdirSync(directory, {
    withFileTypes: true,
  })) {
    const fullPath = path.join(directory, item.name);

    if (item.isDirectory()) {
      result.push(...getFilesRecursively(fullPath));
    } else {
      result.push(fullPath);
    }
  }

  return result;
}

function getArticlePages() {
  if (!fs.existsSync(ARTICLE_DIR)) {
    return [];
  }

  const entries = fs.readdirSync(ARTICLE_DIR, {
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const slug = entry.name;
      const file = path.join(
        ARTICLE_DIR,
        slug,
        "index.html"
      );

      return {
        slug,
        url: `${SITE_ORIGIN}/article/${encodeURIComponent(slug)}/`,
        file,
        exists: fs.existsSync(file),
      };
    })
    .filter((article) => article.exists);
}

function extractTag(html, regex) {
  const match = html.match(regex);
  return match?.[1]?.trim() || "";
}

function extractMeta(html, property) {
  const regex1 = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["'][^>]*>`,
    "i"
  );

  const regex2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["'][^>]*>`,
    "i"
  );

  const regex3 = new RegExp(
    `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["'][^>]*>`,
    "i"
  );

  return (
    extractTag(html, regex1) ||
    extractTag(html, regex2) ||
    extractTag(html, regex3)
  );
}

function extractCanonical(html) {
  return extractTag(
    html,
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i
  );
}

function extractTitle(html) {
  return extractTag(
    html,
    /<title[^>]*>([\s\S]*?)<\/title>/i
  );
}

function extractH1(html) {
  return extractTag(
    html,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i
  );
}

function extractDescription(html) {
  return (
    extractMeta(html, "description") ||
    extractMeta(html, "og:description")
  );
}

function extractImages(html) {
  const matches = html.match(/<img\b[^>]*>/gi) || [];

  return matches.map((tag) => {
    const src =
      extractTag(
        tag,
        /\bsrc=["']([^"']+)["']/i
      ) || "";

    const alt =
      extractTag(
        tag,
        /\balt=["']([^"']*)["']/i
      ) || "";

    return {
      src,
      alt,
    };
  });
}

function extractInternalLinks(html) {
  const links = html.match(
    /href=["']([^"']+)["']/gi
  ) || [];

  return links
    .map((link) => {
      const match = link.match(
        /href=["']([^"']+)["']/i
      );
      return match?.[1] || "";
    })
    .filter(Boolean)
    .map(normalizeUrl)
    .filter((url) => url.startsWith(SITE_ORIGIN));
}

function extractJsonLd(html) {
  const scripts =
    html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
    ) || [];

  const result = [];

  for (const script of scripts) {
    const content = script
      .replace(
        /<script[^>]*>/i,
        ""
      )
      .replace(
        /<\/script>/i,
        ""
      )
      .trim();

    try {
      result.push(JSON.parse(content));
    } catch {
      result.push({
        __invalid: true,
      });
    }
  }

  return result;
}

function getSchemaTypes(data) {
  const types = [];

  for (const item of data) {
    if (item?.__invalid) continue;

    if (Array.isArray(item["@graph"])) {
      for (const graphItem of item["@graph"]) {
        if (graphItem?.["@type"]) {
          types.push(graphItem["@type"]);
        }
      }
    }

    if (item?.["@type"]) {
      types.push(item["@type"]);
    }
  }

  return types.flat().filter(Boolean);
}

function validateRobots() {
  if (!fs.existsSync(ROBOTS_FILE)) {
    addError(
      "ROBOTS_MISSING",
      "robots.txt is missing."
    );
    return;
  }

  const robots = fs.readFileSync(
    ROBOTS_FILE,
    "utf8"
  );

  if (!robots.includes("User-agent: *")) {
    addWarning(
      "ROBOTS_USER_AGENT",
      "robots.txt does not contain User-agent: *."
    );
  } else {
    addPassed(
      "ROBOTS_USER_AGENT",
      "robots.txt contains a global user-agent rule."
    );
  }

  if (!robots.includes("Allow: /")) {
    addWarning(
      "ROBOTS_ALLOW",
      "robots.txt does not explicitly contain Allow: /."
    );
  } else {
    addPassed(
      "ROBOTS_ALLOW",
      "robots.txt allows normal crawling."
    );
  }

  const expectedSitemap =
    `${SITE_ORIGIN}/sitemap.xml`;

  if (!robots.includes(expectedSitemap)) {
    addError(
      "ROBOTS_SITEMAP",
      `robots.txt does not reference ${expectedSitemap}.`
    );
  } else {
    addPassed(
      "ROBOTS_SITEMAP",
      "robots.txt correctly references sitemap.xml."
    );
  }
}

function validateArticle(article) {
  const relativeFile = path.relative(
    ROOT,
    article.file
  );

  let html;

  try {
    html = fs.readFileSync(
      article.file,
      "utf8"
    );
  } catch (error) {
    addError(
      "ARTICLE_READ",
      `Unable to read article: ${error.message}`,
      relativeFile
    );
    return;
  }

  const title = stripHtml(
    extractTitle(html)
  );

  const h1 = stripHtml(
    extractH1(html)
  );

  const description = stripHtml(
    extractDescription(html)
  );

  const canonical = extractCanonical(html);

  const ogTitle =
    extractMeta(html, "og:title");

  const ogDescription =
    extractMeta(html, "og:description");

  const ogImage =
    extractMeta(html, "og:image");

  const ogUrl =
    extractMeta(html, "og:url");

  const twitterCard =
    extractMeta(html, "twitter:card");

  const twitterTitle =
    extractMeta(html, "twitter:title");

  const twitterDescription =
    extractMeta(html, "twitter:description");

  const twitterImage =
    extractMeta(html, "twitter:image");

  const images = extractImages(html);

  const internalLinks =
    extractInternalLinks(html);

  const jsonLd =
    extractJsonLd(html);

  const schemaTypes =
    getSchemaTypes(jsonLd);

  if (!title) {
    addError(
      "TITLE_MISSING",
      "Article has no <title>.",
      relativeFile
    );
  } else if (
    title.length < MIN_TITLE_LENGTH
  ) {
    addWarning(
      "TITLE_SHORT",
      `Title is short (${title.length} characters).`,
      relativeFile
    );
  } else if (
    title.length > MAX_TITLE_LENGTH
  ) {
    addWarning(
      "TITLE_LONG",
      `Title is long (${title.length} characters).`,
      relativeFile
    );
  } else {
    addPassed(
      "TITLE",
      `Title length looks good (${title.length} characters).`,
      relativeFile
    );
  }

  if (!h1) {
    addError(
      "H1_MISSING",
      "Article has no H1.",
      relativeFile
    );
  } else {
    addPassed(
      "H1",
      "Article contains an H1.",
      relativeFile
    );
  }

  if (!description) {
    addError(
      "DESCRIPTION_MISSING",
      "Meta description is missing.",
      relativeFile
    );
  } else if (
    description.length < MIN_DESCRIPTION_LENGTH
  ) {
    addWarning(
      "DESCRIPTION_SHORT",
      `Meta description is short (${description.length} characters).`,
      relativeFile
    );
  } else if (
    description.length > MAX_DESCRIPTION_LENGTH
  ) {
    addWarning(
      "DESCRIPTION_LONG",
      `Meta description is long (${description.length} characters).`,
      relativeFile
    );
  } else {
    addPassed(
      "DESCRIPTION",
      `Meta description length looks good (${description.length} characters).`,
      relativeFile
    );
  }

  if (!canonical) {
    addError(
      "CANONICAL_MISSING",
      "Canonical URL is missing.",
      relativeFile
    );
  } else {
    const canonicalUrl =
      normalizeUrl(canonical);

    if (
      canonicalUrl !== article.url
    ) {
      addWarning(
        "CANONICAL_MISMATCH",
        `Canonical is ${canonicalUrl}, expected ${article.url}.`,
        relativeFile
      );
    } else {
      addPassed(
        "CANONICAL",
        "Canonical URL matches the article URL.",
        relativeFile
      );
    }
  }

  if (!ogTitle) {
    addWarning(
      "OG_TITLE",
      "og:title is missing.",
      relativeFile
    );
  }

  if (!ogDescription) {
    addWarning(
      "OG_DESCRIPTION",
      "og:description is missing.",
      relativeFile
    );
  }

  if (!ogImage) {
    addWarning(
      "OG_IMAGE",
      "og:image is missing.",
      relativeFile
    );
  }

  if (!ogUrl) {
    addWarning(
      "OG_URL",
      "og:url is missing.",
      relativeFile
    );
  }

  if (
    ogTitle &&
    ogDescription &&
    ogImage &&
    ogUrl
  ) {
    addPassed(
      "OPEN_GRAPH",
      "Open Graph metadata is present.",
      relativeFile
    );
  }

  if (!twitterCard) {
    addWarning(
      "TWITTER_CARD",
      "twitter:card is missing.",
      relativeFile
    );
  }

  if (!twitterTitle) {
    addWarning(
      "TWITTER_TITLE",
      "twitter:title is missing.",
      relativeFile
    );
  }

  if (!twitterDescription) {
    addWarning(
      "TWITTER_DESCRIPTION",
      "twitter:description is missing.",
      relativeFile
    );
  }

  if (!twitterImage) {
    addWarning(
      "TWITTER_IMAGE",
      "twitter:image is missing.",
      relativeFile
    );
  }

  if (
    twitterCard &&
    twitterTitle &&
    twitterDescription &&
    twitterImage
  ) {
    addPassed(
      "TWITTER",
      "Twitter/X card metadata is present.",
      relativeFile
    );
  }

  if (jsonLd.length === 0) {
    addError(
      "SCHEMA_MISSING",
      "No JSON-LD structured data found.",
      relativeFile
    );
  } else {
    if (
      jsonLd.some(
        (item) => item.__invalid
      )
    ) {
      addError(
        "SCHEMA_INVALID",
        "At least one JSON-LD block contains invalid JSON.",
        relativeFile
      );
    }

    const usefulSchema =
      schemaTypes.some(
        (type) =>
          [
            "BlogPosting",
            "Article",
            "WebSite",
            "Organization",
            "BreadcrumbList",
          ].includes(type)
      );

    if (usefulSchema) {
      addPassed(
        "SCHEMA",
        `Structured data detected: ${[
          ...new Set(schemaTypes),
        ].join(", ")}`,
        relativeFile
      );
    } else {
      addWarning(
        "SCHEMA_WEAK",
        "JSON-LD exists but expected article/site schema types were not detected.",
        relativeFile
      );
    }
  }

  if (images.length === 0) {
    addWarning(
      "IMAGE_MISSING",
      "No images found in article.",
      relativeFile
    );
  } else {
    const missingAlt =
      images.filter(
        (image) =>
          !image.alt.trim()
      );

    if (missingAlt.length > 0) {
      addWarning(
        "IMAGE_ALT",
        `${missingAlt.length} image(s) are missing alt text.`,
        relativeFile
      );
    } else {
      addPassed(
        "IMAGE_ALT",
        "Article images have alt attributes.",
        relativeFile
      );
    }
  }

  const articleInternalLinks =
    internalLinks.filter(
      (url) =>
        url.includes("/article/")
    );

  if (articleInternalLinks.length === 0) {
    addWarning(
      "INTERNAL_LINKING",
      "Article has no detected internal article links.",
      relativeFile
    );
  } else {
    addPassed(
      "INTERNAL_LINKING",
      `Detected ${articleInternalLinks.length} internal article link(s).`,
      relativeFile
    );
  }

  const wordCount =
    stripHtml(html)
      .split(/\s+/)
      .filter(Boolean)
      .length;

  if (wordCount < 500) {
    addWarning(
      "CONTENT_VOLUME",
      `Detected approximately ${wordCount} words of HTML text.`,
      relativeFile
    );
  } else {
    addPassed(
      "CONTENT_VOLUME",
      `Detected approximately ${wordCount} words of HTML text.`,
      relativeFile
    );
  }

  addInfo(
    "ARTICLE",
    `${article.slug} audited successfully.`,
    relativeFile
  );
}

function buildSitemap(articlePages) {
  const urls = new Map();

  for (const page of STATIC_PAGES) {
    urls.set(
      `${SITE_ORIGIN}${page}`,
      new Date().toISOString()
    );
  }

  for (const article of articlePages) {
    let lastmod;

    try {
      lastmod = fs.statSync(
        article.file
      ).mtime.toISOString();
    } catch {
      lastmod =
        new Date().toISOString();
    }

    urls.set(
      article.url,
      lastmod
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...urls.entries()]
  .map(
    ([url, lastmod]) => `  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>
`;

  fs.writeFileSync(
    SITEMAP_FILE,
    xml,
    "utf8"
  );

  addPassed(
    "SITEMAP_GENERATED",
    `Generated sitemap.xml with ${urls.size} URLs.`
  );
}

function getArticleData(article) {
  const html = fs.readFileSync(
    article.file,
    "utf8"
  );

  const title =
    stripHtml(extractTitle(html)) ||
    article.slug;

  const description =
    stripHtml(extractDescription(html)) ||
    `Read the latest technology story from AZEXAI.`;

  const image =
    extractMeta(html, "og:image");

  const date =
    fs.statSync(
      article.file
    ).mtime.toISOString();

  return {
    title,
    description,
    image: image
      ? normalizeUrl(image)
      : "",
    date,
    url: article.url,
  };
}

function buildRss(articlePages) {
  const articles = articlePages
    .map(getArticleData)
    .sort(
      (a, b) =>
        new Date(b.date) -
        new Date(a.date)
    )
    .slice(0, 50);

  const items = articles
    .map(
      (article) => `<item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(article.url)}</link>
      <guid isPermaLink="true">${escapeXml(article.url)}</guid>
      <description>${escapeXml(article.description)}</description>
      <pubDate>${new Date(article.date).toUTCString()}</pubDate>
      ${
        article.image
          ? `<enclosure url="${escapeXml(article.image)}" type="image/jpeg" />`
          : ""
      }
    </item>`
    )
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AZEXAI</title>
    <link>${SITE_ORIGIN}/</link>
    <description>Technology, AI, software and digital culture.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  fs.writeFileSync(
    RSS_FILE,
    rss,
    "utf8"
  );

  fs.writeFileSync(
    FEED_FILE,
    rss,
    "utf8"
  );

  addPassed(
    "RSS_GENERATED",
    `Generated RSS feeds with ${articles.length} articles.`
  );
}

function detectBrokenLocalArticleLinks(
  articlePages
) {
  const existingUrls =
    new Set(
      articlePages.map(
        (article) => article.url
      )
    );

  for (const article of articlePages) {
    const html = fs.readFileSync(
      article.file,
      "utf8"
    );

    const links =
      extractInternalLinks(html);

    for (const link of links) {
      if (
        !link.includes("/article/")
      ) {
        continue;
      }

      const normalized =
        link.endsWith("/")
          ? link
          : `${link}/`;

      if (
        !existingUrls.has(normalized)
      ) {
        addWarning(
          "BROKEN_INTERNAL_LINK",
          `Internal article link may not exist: ${link}`,
          path.relative(
            ROOT,
            article.file
          )
        );
      }
    }
  }
}

function createReport(articlePages) {
  const report = {
    site: SITE_ORIGIN,
    generatedAt:
      new Date().toISOString(),

    summary: {
      articles: articlePages.length,
      errors: errors.length,
      warnings: warnings.length,
      passed: passed.length,
      info: info.length,
    },

    status:
      errors.length === 0
        ? "PASS"
        : "NEEDS_ATTENTION",

    errors,
    warnings,
    passed,
    info,
  };

  fs.writeFileSync(
    REPORT_FILE,
    JSON.stringify(
      report,
      null,
      2
    ),
    "utf8"
  );

  return report;
}

function printReport(report) {
  console.log("\n");
  console.log(
    "=============================================="
  );
  console.log(
    "          AZEXAI SEO ENGINE"
  );
  console.log(
    "=============================================="
  );

  console.log(
    `\nSite: ${report.site}`
  );

  console.log(
    `Articles: ${report.summary.articles}`
  );

  console.log(
    `\n✓ Passed:   ${report.summary.passed}`
  );

  console.log(
    `⚠ Warnings: ${report.summary.warnings}`
  );

  console.log(
    `✗ Errors:   ${report.summary.errors}`
  );

  console.log(
    `ℹ Info:     ${report.summary.info}`
  );

  if (errors.length) {
    console.log(
      "\nERRORS:"
    );

    for (const item of errors) {
      console.log(
        `  ✗ ${item.code}: ${item.message}`
      );

      if (item.file) {
        console.log(
          `    ${item.file}`
        );
      }
    }
  }

  if (warnings.length) {
    console.log(
      "\nWARNINGS:"
    );

    for (const item of warnings.slice(0, 30)) {
      console.log(
        `  ⚠ ${item.code}: ${item.message}`
      );

      if (item.file) {
        console.log(
          `    ${item.file}`
        );
      }
    }

    if (warnings.length > 30) {
      console.log(
        `  ... ${warnings.length - 30} more warnings`
      );
    }
  }

  console.log(
    "\n=============================================="
  );

  console.log(
    report.status === "PASS"
      ? "AZEXAI SEO ENGINE: PASS ✓"
      : "AZEXAI SEO ENGINE: NEEDS ATTENTION ⚠"
  );

  console.log(
    "==============================================\n"
  );
}

async function main() {
  console.log(
    "\nStarting AZEXAI SEO Engine..."
  );

  const articlePages =
    getArticlePages();

  addInfo(
    "ARTICLE_DISCOVERY",
    `Found ${articlePages.length} generated article pages.`
  );

  validateRobots();

  for (const article of articlePages) {
    validateArticle(article);
  }

  detectBrokenLocalArticleLinks(
    articlePages
  );

  buildSitemap(
    articlePages
  );

  buildRss(
    articlePages
  );

  const report =
    createReport(
      articlePages
    );

  printReport(
    report
  );

  /*
   * Do NOT fail GitHub Actions just because
   * there are warnings.
   *
   * Fail only for real errors.
   */
  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    "\nAZEXAI SEO ENGINE FAILED:"
  );

  console.error(
    error
  );

  process.exitCode = 1;
});
