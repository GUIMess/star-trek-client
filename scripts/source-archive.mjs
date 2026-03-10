import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import manifest from "../data/source-manifest.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputJsonPath = path.join(rootDir, "data", "archive-enrichment.json");
const assetRoot = path.join(rootDir, "public", "archive");
const userAgent = "Codex/1.0 (trek-field-guide sourcing)";

function normalizeUrl(url) {
  return url.replace(/\/\d+px-/g, "/").replace(/\?.*$/, "");
}

function toSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extensionFromResponse(url, contentType) {
  if (contentType?.includes("svg")) return ".svg";
  if (contentType?.includes("png")) return ".png";
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("gif")) return ".gif";

  const parsed = new URL(url);
  const ext = path.extname(parsed.pathname);
  if (ext) return ext;
  return ".jpg";
}

async function fetchJson(url) {
  const response = await fetchWithRetry(url, {
    headers: {
      "user-agent": userAgent,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed ${response.status} for ${url}`);
  }

  return response.json();
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithRetry(url, options, retries = 4) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, options);
    if (response.ok) return response;
    if (attempt === retries || ![429, 500, 502, 503, 504].includes(response.status)) {
      return response;
    }
    await delay(300 * (attempt + 1));
  }

  throw new Error(`Failed to fetch ${url}`);
}

async function fetchWikipediaSummary(title) {
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

  try {
    const summary = await fetchJson(summaryUrl);
    return {
      title,
      summary,
      pageUrl: summary?.content_urls?.desktop?.page ?? null,
      wikidataUrl: summary?.wikibase_item ? `https://www.wikidata.org/wiki/${summary.wikibase_item}` : null,
      imageUrl: summary?.thumbnail?.source ?? summary?.originalimage?.source ?? null,
    };
  } catch {
    return {
      title,
      summary: null,
      pageUrl: null,
      wikidataUrl: null,
      imageUrl: null,
    };
  }
}

async function searchCommons(term) {
  if (!term) return [];

  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=960&format=json&origin=*`;

  try {
    const json = await fetchJson(url);
    const pages = Object.values(json?.query?.pages ?? {});
    return pages
      .map((page) => ({
        title: page.title,
        url: page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url ?? null,
      }))
      .filter((item) => item.url);
  } catch {
    return [];
  }
}

async function downloadAsset(url, slug, index) {
  const response = await fetchWithRetry(url, {
    headers: {
      "user-agent": userAgent,
      accept: "image/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${url}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const extension = extensionFromResponse(url, contentType);
  const assetDir = path.join(assetRoot, slug);
  await mkdir(assetDir, { recursive: true });
  const filename = `${String(index + 1).padStart(2, "0")}${extension}`;
  const filepath = path.join(assetDir, filename);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(filepath, buffer);

  return `/archive/${slug}/${filename}`;
}

function makeCartography(cartography) {
  if (!cartography) return null;

  return {
    quadrant: cartography.quadrant,
    sector: cartography.sector,
    gridLabel: cartography.gridLabel,
    rangeLabel: cartography.rangeLabel,
    x: cartography.x,
    y: cartography.y,
  };
}

async function buildEntityRecord(entry) {
  const summaryBundle = entry.wikipediaTitle ? await fetchWikipediaSummary(entry.wikipediaTitle) : null;
  const summary = summaryBundle?.summary ?? null;
  const summaryText = entry.abstractOverride ?? summary?.extract ?? null;
  const summaryPage = summaryBundle?.pageUrl ?? null;
  const wikidataUrl = summaryBundle?.wikidataUrl ?? null;
  const commonsCandidates = entry.commonsQuery ? await searchCommons(entry.commonsQuery) : [];

  const assetCandidates = [];
  const seen = new Set();

  if (summaryBundle?.imageUrl && summaryBundle.imageUrl.includes("/wikipedia/commons/")) {
    const normalized = normalizeUrl(summaryBundle.imageUrl);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      assetCandidates.push({
        title: summary?.title ?? entry.wikipediaTitle,
        url: summaryBundle.imageUrl,
        sourceKey: "wikimedia-commons",
        caption: "Archive reference image",
      });
    }
  }

  for (const candidate of commonsCandidates) {
    const normalized = normalizeUrl(candidate.url);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    assetCandidates.push({
      title: candidate.title.replace(/^File:/, ""),
      url: candidate.url,
      sourceKey: "wikimedia-commons",
      caption: "Commons archival asset",
    });
    if (assetCandidates.length >= 2) break;
  }

  const media = [];
  for (let index = 0; index < assetCandidates.length; index += 1) {
    const candidate = assetCandidates[index];
    try {
      const localSrc = await downloadAsset(candidate.url, entry.slug, index);
      media.push({
        id: `${entry.slug}-media-${index + 1}`,
        kind: index === 0 ? "portrait" : "gallery",
        title: candidate.title,
        src: localSrc,
        alt: `${entry.slug.replaceAll("-", " ")} archive asset ${index + 1}`,
        caption: candidate.caption,
        credit: candidate.title,
        sourceKey: candidate.sourceKey,
      });
    } catch {
      // Ignore failed asset downloads so the archive still builds.
    }
    await delay(120);
  }

  const citations = [];

  if (summaryPage) {
    citations.push({
      label: "Wikipedia overview",
      url: summaryPage,
      note: "Public encyclopedia summary used for archive abstract and page linkage.",
      sourceKey: "wikipedia",
    });
  }

  if (wikidataUrl) {
    citations.push({
      label: "Wikidata record",
      url: wikidataUrl,
      note: "Structured cross-wiki identifier and metadata anchor.",
      sourceKey: "wikidata",
    });
  }

  if (entry.memoryAlphaPath) {
    citations.push({
      label: "Memory Alpha entry",
      url: `https://memory-alpha.fandom.com/wiki/${entry.memoryAlphaPath}`,
      note: "Reference trail for canon-adjacent browsing and terminology.",
      sourceKey: "memory-alpha",
    });
  }

  if (media.length) {
    citations.push({
      label: "Wikimedia Commons asset trail",
      url: "https://commons.wikimedia.org/",
      note: "Local archive visuals are sourced from Wikimedia-hosted assets where possible.",
      sourceKey: "wikimedia-commons",
    });
  }

  return [
    entry.slug,
    {
      descriptor: summary?.description ?? null,
      bioSections: [
        ...(summaryText
          ? [
              {
                heading: "Archive abstract",
                body: summaryText,
              },
            ]
          : []),
        {
          heading: "Operational read",
          body: entry.opsNote,
        },
      ],
      media,
      citations,
      cartography: makeCartography(entry.cartography),
    },
  ];
}

async function main() {
  await mkdir(assetRoot, { recursive: true });

  const entityRecords = {};

  for (const entry of manifest) {
    const [slug, record] = await buildEntityRecord(entry);
    entityRecords[slug] = record;
    await delay(180);
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    entities: entityRecords,
  };

  await writeFile(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${outputJsonPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
